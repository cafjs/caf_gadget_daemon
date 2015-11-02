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
 * Wrapper to an application deployed in a container.
 *
 *
 * @name caf_gadget_daemon/plug_application
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

var assert = require('assert');

var caf_comp = require('caf_components');
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var fs = require('fs');

var callJustOnce = function($, cb) {
    return myUtils.callJustOnce(function(err, data) {
        $._.$.log && $._.$.log.debug('Ignore Call >1: err:' +
                                     myUtils.errToPrettyStr(err) +
                                     ' data:' + JSON.stringify(data));
    }, cb);
};

var NAME_SEPARATOR = '-'; // duplicate to avoid a dependency with json_rpc.js

/**
 * Factory method  to wrap apps in containers.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);

        var containerId = null;

        $._.$.log && $._.$.log.debug('New application plug');


        assert.equal(typeof(spec.env.tokenFile), 'string',
                     "'spec.env.tokenFile' is not a string");

        assert.equal(typeof(spec.env.image), 'string',
                     "'spec.env.image' is not a string");

        assert.equal(typeof(spec.env.myId), 'string',
                     "'spec.env.myId' is not a string");

        assert.equal(typeof(spec.env.privileged), 'boolean',
                     "'spec.env.privileged' is not a boolean");

        var extraCreateOptions = spec.env.extraCreateOptions;
        if (typeof(spec.env.extraCreateOptions) === 'string') {
            extraCreateOptions = JSON.parse(spec.env.extraCreateOptions);
        }
        assert.equal(typeof (extraCreateOptions), 'object',
                     "'spec.env.extraCreateOptions' is not an object");


        var extraStartOptions = spec.env.extraStartOptions;
        if (typeof(spec.env.extraStartOptions) === 'string') {
            extraStartOptions = JSON.parse(spec.env.extraStartOptions);
        }
        assert.equal(typeof (extraStartOptions), 'object',
                     "'spec.env.extraStartOptions' is not an object");

        var cmdArray = ((typeof(spec.env.cmdArray) === 'string') ?
                        JSON.parse(spec.env.cmdArray) :
                        spec.env.cmdArray);
        assert.ok(Array.isArray(cmdArray),
                  "'spec.env.cmdArray' is not an array");

        assert.equal(typeof(spec.env.appName), 'string',
                     "'spec.env.appName' is not a string");

        var appNameSplit = spec.env.appName.split(NAME_SEPARATOR);
        assert.equal(appNameSplit.length, 2, "'spec.env.appName' is invalid");

        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");


        var outStream = null;
        if (spec.env.outputFile) {
            outStream = fs.createWriteStream(outStream);
        }

        that.getContainerId = function() {
            return containerId;
        };

        var startContainer = function(cb0) {
            var cb1 = callJustOnce($, cb0);
            var docker = $._.$.docker.cli;
            var createOptions =  {
                Hostname: spec.env.myId
            };
            myUtils.mixin(createOptions, extraCreateOptions);
            createOptions.Env = (createOptions.Env ? createOptions.Env : []);
            createOptions.Env.push('MY_ID=' + spec.env.myId);
            createOptions.Env.push('TOKEN_FILE=/config/token');
            createOptions.Env.push('APP_PUBLISHER=' + appNameSplit[0]);
            createOptions.Env.push('APP_LOCAL_NAME=' + appNameSplit[1]);
            createOptions.Env.push('APP_PROTOCOL=' + spec.env.appProtocol);
            createOptions.Env.push('APP_SUFFIX=' + spec.env.appSuffix);

            var startOptions = {
                Privileged: spec.env.privileged
            };
            myUtils.mixin(startOptions, extraStartOptions);
            startOptions.Binds = (startOptions.Binds ? startOptions.Binds : []);
            startOptions.Binds.push(spec.env.tokenFile + ":/config/token");

            var job = docker.run(spec.env.image, cmdArray, null,
                                 createOptions, startOptions,
                                 function (err, data, container) {
                                     /* Container has finished, ensure that
                                      * we are shutdown, but callback
                                      * only propagates once and may be ignored.
                                      */
                                     that.__ca_shutdown__(null, cb1);
                                 });

            job.on('container', function(container) {
                $._.$.log && $._.$.log.debug('Container up, id:' +
                                             container.id);
                containerId = container.id;
                cb1(null);
            });

            job.on('stream', function(stream) {
                stream.setEncoding('utf8');
                if (outStream) {
                    stream.pipe(outStream , {end: true});
                } else {
                    stream.pipe(process.stdout); // don't close stdout
                }
            });

        };

        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    if (containerId) {
                        var docker = $._.$.docker.cli;
                        containerId = null;
                        var container = docker.getContainer(containerId);
                        if (container) {
                            container.stop(function(err) {
                                if (err) {
                                    $._.$.log &&
                                        $._.$.log.debug('Cannot stop ' +
                                                        containerId);
                                    cb0(err);
                                } else {
                                    container.remove(function(err) {
                                        if (err) {
                                            $._.$.log &&
                                                $._.$.log.debug('Cannot rm ' +
                                                                containerId);
                                            cb0(err);
                                        } else {
                                            cb0(null);
                                        }
                                    });
                                }
                            });
                        } else {
                            cb0(null);
                        }
                    } else {
                        cb0(null);
                    }
                }
            });
        };

        startContainer(function(err) {
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
