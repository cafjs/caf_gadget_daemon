// Modifications copyright 2020 Caf.js Labs and contributors
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

'use strict';

/**
 * Manages an app in a docker container.
 *
 *
 * @name caf_gadget_daemon/plug_manager
 * @namespace
 * @augments caf_components/gen_dynamic_container
 *
 */
const assert = require('assert');
const caf_iot = require('caf_iot');
const json_rpc = caf_iot.caf_transport.json_rpc;
const caf_comp = caf_iot.caf_components;
const myUtils = caf_comp.myUtils;
const async = caf_comp.async;
const genDynamicContainer = caf_comp.gen_dynamic_container;
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const utilManager = require('./util_manager');

/**
 * Factory method for a manager of apps.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = async function($, spec) {
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

        assert.equal(typeof(spec.env.configVolume), 'string',
                     "'spec.env.configVolume' is not a string");

        assert.equal(typeof(spec.env.myId), 'string',
                     "'spec.env.myId' is not a string");

        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        assert.equal(typeof spec.env.trustedPubKeyFile, 'string',
                     "'spec.env.trustedPubKeyFile' not a string");

        assert.equal(typeof spec.env.privilegedNetwork, 'string',
                     "'spec.env.privilegedNetwork' not a string");

        if (spec.env.debugApplication) {
            assert.equal(typeof spec.env.debugApplication, 'boolean',
                         "'spec.env.debugApplication' not a boolean");
            assert.equal(typeof spec.env.debuggerPort, 'number',
                         "'spec.env.debuggerPort' not a number");
            assert.equal(typeof spec.env.nodeDebugOptions, 'string',
                         "'spec.env.nodeDebugOptions' not a string");
        }

        var network = 'bridge';
        if (Array.isArray(spec.env.networks)) {
            if (spec.env.networks.length === 1) {
                network = $._.$[spec.env.networks[0]].getName();
            } else if (spec.env.networks.length > 1) {
                throw new Error('Multiple networks not supported');
            }
        }

        const privilegedNetwork = spec.env.privilegedNetwork;

        const that = genDynamicContainer.create($, spec);

        /* Type of returned app info is:
         *   {appName: string, etag:string,
         *     meta: {privileged: boolean, properties: string}, token: string}
         */
        that.getCurrentAppInfo = function() {
            const res = that.__ca_allChildren__();
            if (res.length === 0) {
                return null;
            } else if (res.length == 1) {
                const appSpec = that.__ca_getChildSpec__(res[0]);
                return {
                    appName: appSpec.env.appName,
                    etag: appSpec.env.appEtag,
                    meta: appSpec.env.appMeta,
                    token: appSpec.env.appToken
                };
            } else {
                const err = new Error('Bug: too many active apps');
                err.apps = res;
                throw err;
            }
        };

        /*
         * Type for cloudState:
         * {appName: string, meta: {privileged: boolean, properties: string},
         *   status:string, token: string}
         */
        const start = function(cloudState, cb0) {
            const appInfo = {
                appName: cloudState.appName,
                meta: cloudState.meta,
                token: cloudState.token
            };
            if (!appInfo.token) {
                cb0(new Error('Missing token'));
            } else {
                async.waterfall([
                    function(cb1) {
                        $._.$.cloud.cli.updateStatus('STARTING', cb1);
                    },
                    function(_state, cb1) {
                        $._.$.builder.buildImage(appInfo.appName, appInfo.meta,
                                                 cb1);
                    },
                    function(imageInfo, cb1) {
                        appInfo.etag = imageInfo.etag;
                        appInfo.imageId = imageInfo.id;
                        appInfo.tokenDir =
                            path.resolve(path.join(spec.env.tokenDir,
                                                   'token.' + appInfo.appName));
                        async.series([
                            function(cb2) {
                                mkdirp(appInfo.tokenDir, cb2);
                            },
                            function(cb2) {
                                const tF = path.join(appInfo.tokenDir,
                                                     spec.env.tokenFile);
                                fs.writeFile(tF, appInfo.token, cb2);
                            }
                        ], function(err) {
                            cb1(err, null);
                        });
                    },
                    function(_ignore, cb1) {
                        /*
                         * This manager is using a host volume mounted with
                         *   -v externalPrefix:internalPrefix
                         * and it is writing to a directory 'dir' that is in
                         * volume `internalPrefix'.
                         *
                         *  We want the app container to read that directory,
                         * so we need to rewrite the path of that directory, so
                         * that it is relative to `externalPrefix` instead.
                         */
                        const toExternalPath = function(internalPrefix,
                                                        externalPrefix, dir) {
                            return path.resolve(externalPrefix,
                                                path.relative(internalPrefix,
                                                              dir));
                        };

                        const privileged = cloudState.meta &&
                                cloudState.meta.privileged;
                        const appExtraProps = cloudState.meta &&
                                cloudState.meta.properties || '{}';
                        const childTokenDir =
                                toExternalPath('/config',
                                               spec.env.configVolume,
                                               appInfo.tokenDir);

                        that.__ca_instanceChild__(null, {
                            name: appInfo.appName,
                            env: {
                                tokenDir: childTokenDir,
                                tokenFile: spec.env.tokenFile,
                                image: appInfo.imageId,
                                myId: spec.env.myId,
                                appName: appInfo.appName,
                                appProtocol: spec.env.appProtocol,
                                appSuffix: spec.env.appSuffix,
                                netName: privileged ? privilegedNetwork :
                                    network,
                                trustedPubKeyFile: spec.env
                                    .trustedPubKeyFile,
                                appDevices: spec.env.appDevices,
                                appPrivileged: privileged ? true :
                                    spec.env.appPrivileged,
                                appExtraProps: appExtraProps,
                                debugApplication: spec.env.debugApplication,
                                nodeDebugOptions: spec.env.nodeDebugOptions,
                                debuggerPort: spec.env.debuggerPort,
                                // this is for `getCurrentAppInfo()`
                                appEtag: appInfo.etag,
                                appMeta: appInfo.meta,
                                appToken: appInfo.token

                            }
                        }, cb1);
                    }
                ], function(err) {
                    if (err) {
                        cb0(err);
                    } else {
                        $._.$.cloud.cli.updateStatus('RUNNING', cb0);
                    }
                });
            }
        };

        const refresh = function(cb0) {
            const hasChanged = function(state, cb1) {
                const appInfo = that.getCurrentAppInfo();
                if (appInfo === null) {
                    cb1(null, (typeof state.appName === 'string'));
                } else if ((appInfo.appName !== state.appName) ||
                           (appInfo.token !== state.token) ||
                           (!myUtils.deepEqual(appInfo.meta, state.meta))) {
                    cb1(null, true);
                } else {
                    $._.$.builder.hasEtagChanged(appInfo.appName, appInfo.etag,
                                                 cb1);
                }
            };

            const stop = function(cb1) {
                const appInfo = that.getCurrentAppInfo();
                if (appInfo) {
                    that.__ca_deleteChild__(null, appInfo.appName, cb1);
                } else {
                    cb1(null);
                }
            };

            const reloadStateImpl = function(cb1) {
                let cloudState = null;
                async.waterfall([
                    function(cb2) {
                        $._.$.cloud.cli.getState(cb2);
                    },
                    function(state, cb2) {
                        cloudState = state;
                        hasChanged(state, cb2);
                    },
                    function(changed, cb2) {
                        if (changed) {
                            async.series([
                                stop,
                                function(cb3) {
                                    if (cloudState.appName) {
                                        start(cloudState, cb3);
                                    } else {
                                        cb3(null);
                                    }
                                }
                            ], cb2);
                        } else {
                            cb2(null);
                        }
                    }
                ], cb1);
            };
            reloadStateImpl(cb0);
            // myUtils.retryWithDelay(reloadStateImpl, spec.env.maxTokenRetries,
            //                        spec.env.retryDelay, cb0);
        };

        const queue = async.queue(function(req, cb1) {
            if (req.cmd === 'refresh') {
                refresh(cb1);
            } else {
                const err = new Error('Invalid request');
                err.req = req;
                cb1(err);
            }
        }, 1); // sequential

        that.refreshState = function(cb0) {
            const defaultCB = function(err) {
                if (err) {
                    $._.$.log && $._.$.log.debug('Got error, shutting down:' +
                                                 myUtils.errToPrettyStr(err));
                    that.__ca_shutdown__(null, function(err) {
                        if (err) {
                            $._.$.log &&
                                $._.$.log.fatal('Cannot shutdown' +
                                                myUtils.errToPrettyStr(err));
                            throw (err); // unhandled exception, kills process
                        }
                    });
                }
            };
            cb0 = cb0 || defaultCB;
            if (queue.length() === 0) {
                queue.push({cmd: 'refresh'}, cb0);
            } else {
                cb0(null);
            }
        };

        // Refresh on cloud notifications.
        $._.$.cloud.registerHandler(function(msg) {
            $._.$.log && $._.$.log.debug('Got notification:' +
                                         JSON.stringify(msg));
            that.refreshState();
        });


        const super__ca_instanceChild__ =
                myUtils.superior(that, '__ca_instanceChild__');
        /**
         *  Creates an app if not already created.
         *
         * @param {Object=} data An optional hint on how to add the child.
         * @param {Object} specEnv An extra child description to override a
         * default one. At a minimum `specEnv.name` should define the name
         * for this app.
         * @param {caf.cb} cb0 A callback to return an error if I cannot
         * create the app.
         *
         * @name plug_manager#__ca_instanceChild__
         * @function
         */
        that.__ca_instanceChild__ = function(data, specEnv, cb0) {
            try {
                assert.equal(typeof(specEnv.name), 'string',
                             "'specEnv.name' is not a string");
                const fullName = specEnv.name + json_rpc.NAME_SEPARATOR +
                        spec.env.myId;
                utilManager.eliminateByName($, fullName, function(err) {
                    if (err) {
                        cb0(err);
                    } else {
                        try {
                            const desc = $._.$.loader.__ca_loadDescription__(
                                spec.env.__app_json__, true, specEnv
                            );
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

        const p = new Promise((resolve) => {
            try {
                that.refreshState(function(err) {
                    if (err) {
                        resolve([err]);
                    } else {
                        resolve([null, that]);
                    }
                });
            } catch (err) {
                resolve([err]);
            }
        });
        return p;
    } catch (err) {
        return [err];
    }
};
