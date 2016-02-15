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
var caf_iot =  require('caf_iot');
var caf_comp = caf_iot.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var fs = require('fs');
var utilManager = require('./util_manager');

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


        assert.equal(typeof(spec.env.tokenDir), 'string',
                     "'spec.env.tokenDir' is not a string");

        assert.equal(typeof(spec.env.tokenFile), 'string',
                     "'spec.env.tokenFile' is not a string");

        assert.equal(typeof(spec.env.mailboxDir), 'string',
                     "'spec.env.mailboxDir' is not a string");

        assert.equal(typeof(spec.env.mailboxFile), 'string',
                     "'spec.env.mailboxFile' is not a string");

        assert.equal(typeof(spec.env.image), 'string',
                     "'spec.env.image' is not a string");

        assert.equal(typeof(spec.env.myId), 'string',
                     "'spec.env.myId' is not a string");
        
        assert.equal(Array.isArray(spec.env.appDevices), true,
                     "'spec.env.appDevices' is not an array");

        assert.equal(typeof(spec.env.appPrivileged), 'boolean',
                     "'spec.env.appPrivileged' is not a boolean");

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
            outStream = fs.createWriteStream(spec.env.outputFile);
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
            createOptions.name = spec.env.appName;
            createOptions.Env = (createOptions.Env ? createOptions.Env : []);
            createOptions.Env.push('MY_ID=' + spec.env.myId);
            createOptions.Env.push('TOKEN_FILE='+ spec.env.tokenFile);
            createOptions.Env.push('TOKEN_DIR=/config');
            createOptions.Env.push('MAILBOX_FILE='+ spec.env.mailboxFile);
            createOptions.Env.push('MAILBOX_DIR=/control');

            createOptions.Env.push('APP_PUBLISHER=' + appNameSplit[0]);
            createOptions.Env.push('APP_LOCAL_NAME=' + appNameSplit[1]);
            createOptions.Env.push('APP_PROTOCOL=' + spec.env.appProtocol);
            createOptions.Env.push('APP_SUFFIX=' + spec.env.appSuffix);
            createOptions.Env.push('TRUSTED_PUB_KEY_FILE=' +
                                   spec.env.trustedPubKeyFile);
            var expandDevices = function(devices) {
                return devices.map(function(x) {
                    return {"PathOnHost": x,
                            "PathInContainer": x,
                            "CgroupPermissions": "rwm"
                           };
                });
            };
            var startOptions = {
                Privileged: spec.env.appPrivileged,
                NetworkMode: spec.env.netName,
                Devices: expandDevices(spec.env.appDevices)
            };
            myUtils.mixin(startOptions, extraStartOptions);
            startOptions.Binds = (startOptions.Binds ? startOptions.Binds : []);
            startOptions.Binds.push(spec.env.tokenDir + ":/config");
            startOptions.Binds.push(spec.env.mailboxDir + ":/control");

            var job = docker.run(spec.env.image, cmdArray, null,
                                 createOptions, startOptions,
                                 function (err, data, container) {
                                     /* Container has finished, ensure that
                                      * we are shutdown.
                                      */
                                     if (err) {
                                         var msg = 'Container terminates with' +
                                                 ' error :'; 
                                         $._.$.log && $._.$.log
                                             .debug(msg + myUtils
                                                    .errToPrettyStr(err));
                                     }
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
                        var containerIds = [containerId];
                        containerId = null;
                        utilManager.eliminateContainers($, containerIds, cb0);
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
