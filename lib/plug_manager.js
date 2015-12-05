/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";

/**
 * Manages an app in a docker container.
 *
 *
 * @name caf_gadget_daemon/plug_manager
 * @namespace
 * @augments caf_components/gen_dynamic_container
 *
 */
var assert = require('assert');
var caf_iot =  require('caf_iot');
var caf_comp = caf_iot.caf_components;
var myUtils = caf_comp.myUtils;
var async = caf_comp.async;
var genDynamicContainer = caf_comp.gen_dynamic_container;
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var utilManager = require('./util_manager');

/**
 * Factory method for a manager of apps.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        $._.$.log && $._.$.log.debug('New Manager plug');

        assert.equal(typeof(spec.env.__app_json__), 'string',
                     "'spec.env.__app_json__' is not a string");

        assert.equal(typeof(spec.env.maxTokenRetries), 'number',
                     "'spec.env.maxTokenRetries' is not a number");

        assert.equal(typeof(spec.env.tokenDir), 'string',
                     "'spec.env.tokenDir' is not a string");

        assert.equal(typeof(spec.env.tokenFile), 'string',
                     "'spec.env.tokenFile' is not a string");

        assert.equal(typeof(spec.env.mailboxDir), 'string',
                     "'spec.env.mailboxDir' is not a string");

        assert.equal(typeof(spec.env.mailboxFile), 'string',
                     "'spec.env.mailboxFile' is not a string");

        assert.equal(typeof(spec.env.myId), 'string',
                     "'spec.env.myId' is not a string");

        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        /* state of this gadget CA: type:
         *
         *   {appName: string, token:string, status: string}
         */
        var cloudState = null;

        var that = genDynamicContainer.constructor($, spec);

        var super__ca_instanceChild__ = myUtils
            .superior(that, '__ca_instanceChild__');

        /**
         *  Creates an app if not already created.
         *
         * @param {Object=} data An optional hint on how to add the child.
         * @param {Object} specEnv An extra child description to override a
         * default one. At a minimum `specEnv.name` should define the name
         * for this app.
         * @param {caf.cb} cb A callback to return an error if I cannot
         * create the app.
         *
         * @name plug_manager#__ca_instanceChild__
         * @function
         */
        that.__ca_instanceChild__ = function(data, specEnv, cb0) {
            try {
                assert.equal(typeof(specEnv.name), 'string',
                             "'specEnv.name' is not a string");
                utilManager.eliminateByName($, specEnv.name, function(err) {
                    if (err) {
                        cb0(err);
                    } else {
                        try {
                            var desc = $._.$.loader
                                    .__ca_loadDescription__(spec.env
                                                            .__app_json__,
                                                            true, specEnv);
                            super__ca_instanceChild__(data, desc, cb0);
                        } catch (error) {
                            cb0(error);
                        }
                    }
                });
            } catch (err) {
                cb0(err);
            }
        };

        that.appName = function() {
            var res = that.__ca_allChildren__();
            if (res.length === 0) {
                return null;
            } else if (res.length == 1) {
                return res[0];
            } else {
                var err = new Error("Bug: too many active apps");
                err.apps = res;
                throw err;
            }
        };

        var updateStatus = function(newStatus, cb0) {
            $._.$.cloud.cli.updateStatus(newStatus, function(err, state) {
                if (err) {
                    cb0(err);
                } else {
                    cloudState = state;
                    cb0(null, state);
                }
            });
        };

        var getToken = function(name, cb0) {
            var getTokenImpl = function(cb1) {
                $._.$.cloud.cli.getState(function(err, state) {
                    if (err) {
                        cb1(err);
                    } else {
                        cloudState = state;
                        if (state.appName !== name) {
                            // early abort
                            cb1(null, null);
                        } else  if (!state.token) {
                            $._.$.log &&
                                $._.$.log.debug('Missing token, retrying...');
                            cb1(new Error('Missing token'));
                        } else {
                            cb1(null, state.token);
                        }
                    }
                });
            };
            myUtils.retryWithDelay(getTokenImpl, spec.env.maxTokenRetries,
                                   spec.env.retryDelay, cb0);
        };

        var start = function(name, cb0) {
            var startImpl = function(cb1) {
                var image;
                var tDir = null;
                async.waterfall([
                    function(cb2) {
                        updateStatus('STARTING', cb2);
                    },
                    function(_state, cb2) {
                        $._.$.builder.buildImage(name, cb2);
                    },
                    function(imageId, cb2) {
                        if (imageId === null) {
                            // early abort
                            cb2(new Error('No image id'));
                        } else {
                            image = imageId;
                            getToken(name, cb2);
                        }
                    },
                    function(token, cb2) {
                        tDir = path.resolve(path.join(spec.env.tokenDir,
                                                      'token.' + name));
                        mkdirp(tDir, function(err) {
                            if (err) {
                                cb2(err);
                            } else {
                                cb2(null, token);
                            }
                        });
                    },
                    function(token, cb2) {
                        if (!token) {
                            cb2(null, null);
                        } else {
                            var tF = path.join(tDir, spec.env.tokenFile);
                            fs.writeFile(tF, token, function(err) {
                                if (err) {
                                    cb2(err);
                                } else {
                                    cb2(null, tDir);
                                }
                            });
                        }
                    },
                    function(tokenDir, cb2) {
                        if (tokenDir === null) {
                            cb2(new Error('No token: early abort'));
                        } else {
                            that.__ca_instanceChild__(null, {
                                name: name,
                                env: {
                                    tokenDir: tokenDir,
                                    tokenFile: spec.env.tokenFile,
                                    mailboxDir: spec.env.mailboxDir,
                                    mailboxFile: spec.env.mailboxFile,
                                    image: image,
                                    myId: spec.env.myId,
                                    appName: name,
                                    appProtocol: spec.env.appProtocol,
                                    appSuffix: spec.env.appSuffix
                                }
                            }, cb2);
                        }
                    }
                ], function(err) {
                    if (err) {
                        cb1(err);
                    } else {
                        updateStatus('RUNNING', cb1);
                    }
                });
            };

            var current = that.appName();
            if (current === name) {
                // do nothing
                cb0(null);
            } else  {
                async.series([
                    function(cb1) {
                        stop(null, cb1);
                    },
                    startImpl
                ], cb0);
            }
        };

        var stop = function(name, cb0) {
            name = name || that.appName();
            if (name) {
                that.__ca_deleteChild__(null, name, cb0);
            } else {
                cb0(null);
            }
        };

        var update = function(name, cb0) {
            async.series([
                function(cb1) {
                    stop(name, cb1);
                },
                function(cb1) {
                    start(name, cb1);
                }], cb0);
        };

        var refresh = function(cb0) {
            var reloadStateImpl = function(cb1) {
                $._.$.cloud.cli.getState(function(err, state) {
                    if (err) {
                        cb1(err);
                    } else {
                        cloudState = state;
                        if (state.appName &&
                            (state.appName !==  that.appName())) {
                            start(state.appName, cb1);
                        } else  {
                            cb1(null, state);
                        }
                    }
                });
            };
            myUtils.retryWithDelay(reloadStateImpl, spec.env.maxTokenRetries,
                                   spec.env.retryDelay, cb0);
        };

        var queue = async.queue(function(req, cb0) {
            if (req.cmd === 'start') {
                start(req.name, cb0);
            } else if (req.cmd === 'stop') {
                stop(req.name, cb0);
            }  else if (req.cmd === 'update') {
                update(req.name, cb0);
            }  else if (req.cmd === 'refresh') {
                refresh(cb0);
            } else {
                var err = new Error('Invalid request');
                err.req = req;
                cb0(err);
            };
        }, 1); // sequential

        that.startApp = function(name, cb0) {
            queue.push({cmd: 'start', name : name}, cb0);
        };

        that.stopApp = function(name, cb0) {
            queue.push({cmd: 'stop', name: name} , cb0);
        };

        that.updateApp = function(name, cb0) {
            name = name || that.appName();
            if (!name) {
                cb0(new Error('No app name for updateApp'));
            } else {
                queue.push({cmd: 'update', name: name} , cb0);
            }
        };


        that.refreshState = function(cb0) {
            var defaultCB = function(err) {
                if (err) {
                    $._.$.log && $._.$.log.debug('Got error, shutting down:' +
                                                 myUtils.errToPrettyStr(err));
                    that.__ca_shutdown__(null, function(err) {
                        if (err) {
                            $._.$.log &&
                                $._.$.log.fatal('Cannot shutdown' +
                                                myUtils.errToPrettyStr(err));
                            throw(err); // unhandled exception, kills process
                        }
                    });
                }
            };
            cb0 = cb0 || defaultCB;
            queue.push({cmd: 'refresh'} , cb0);
        };

        $._.$.cloud.registerHandler(function(msg) {
            $._.$.log && $._.$.log.debug('Got notification:' +
                                         JSON.stringify(msg));
            that.refreshState();
        });

        that.refreshState(function(err) {
            if (err) {
                cb(err);
            } else {
                cb(null, that);
            }
        });
    } catch (err) {
        cb(err);
    }
};
