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
 * Wrapper to an application deployed in a container.
 *
 *
 * @name caf_gadget_daemon/plug_application
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

const assert = require('assert');
const caf_iot = require('caf_iot');
const json_rpc = caf_iot.caf_transport.json_rpc;
const caf_comp = caf_iot.caf_components;
const myUtils = caf_comp.myUtils;
const genPlug = caf_comp.gen_plug;
const fs = require('fs');
const utilManager = require('./util_manager');

const callJustOnce = function($, cb) {
    return myUtils.callJustOnce(function(err, data) {
        $._.$.log && $._.$.log.debug('Ignore Call >1: err:' +
                                     myUtils.errToPrettyStr(err) +
                                     ' data:' + JSON.stringify(data));
    }, cb);
};


/**
 * Factory method  to wrap apps in containers.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);

        var containerId = null;

        $._.$.log && $._.$.log.debug('New application plug');


        assert.equal(typeof(spec.env.tokenDir), 'string',
                     "'spec.env.tokenDir' is not a string");

        assert.equal(typeof(spec.env.tokenFile), 'string',
                     "'spec.env.tokenFile' is not a string");

        assert.equal(typeof(spec.env.image), 'string',
                     "'spec.env.image' is not a string");

        assert.equal(typeof(spec.env.myId), 'string',
                     "'spec.env.myId' is not a string");

        assert.equal(Array.isArray(spec.env.appDevices), true,
                     "'spec.env.appDevices' is not an array");

        assert.equal(typeof(spec.env.appPrivileged), 'boolean',
                     "'spec.env.appPrivileged' is not a boolean");

        if (spec.env.debugApplication) {
            assert.equal(typeof spec.env.debugApplication, 'boolean',
                         "'spec.env.debugApplication' not a boolean");
            assert.equal(typeof spec.env.debuggerPort, 'number',
                         "'spec.env.debuggerPort' not a number");
            assert.equal(typeof spec.env.nodeDebugOptions, 'string',
                         "'spec.env.nodeDebugOptions' not a string");
        }

        let extraCreateOptions = spec.env.extraCreateOptions;
        if (typeof(spec.env.extraCreateOptions) === 'string') {
            extraCreateOptions = JSON.parse(spec.env.extraCreateOptions);
        }
        assert.equal(typeof (extraCreateOptions), 'object',
                     "'spec.env.extraCreateOptions' is not an object");


        let extraHostConfig = spec.env.extraHostConfig;
        if (typeof(spec.env.extraHostConfig) === 'string') {
            extraHostConfig = JSON.parse(spec.env.extraHostConfig);
        }
        assert.equal(typeof (extraHostConfig), 'object',
                     "'spec.env.extraHostConfig' is not an object");

        const cmdArray = (typeof(spec.env.cmdArray) === 'string') ?
            JSON.parse(spec.env.cmdArray) :
            spec.env.cmdArray;
        assert.ok(Array.isArray(cmdArray),
                  "'spec.env.cmdArray' is not an array");

        assert.equal(typeof(spec.env.appName), 'string',
                     "'spec.env.appName' is not a string");

        const appNameSplit = spec.env.appName.split(json_rpc.NAME_SEPARATOR);
        assert.equal(appNameSplit.length, 2, "'spec.env.appName' is invalid");

        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        assert.equal(typeof spec.env.appExtraProps, 'string',
                     "'spec.env.appExtraProps' not a string");


        var outStream = null;
        if (spec.env.outputFile) {
            outStream = fs.createWriteStream(spec.env.outputFile);
        }

        that.getContainerId = function() {
            return containerId;
        };

        const startContainer = function(cb0) {
            const cb1 = callJustOnce($, cb0);
            const docker = $._.$.docker.cli;
            const createOptions = {
                Hostname: spec.env.myId
            };
            myUtils.mixin(createOptions, extraCreateOptions);
            createOptions.name = spec.env.appName + json_rpc.NAME_SEPARATOR +
                spec.env.myId;
            createOptions.Env = (createOptions.Env ? createOptions.Env : []);
            createOptions.Env.push('MY_ID=' + spec.env.myId);
            createOptions.Env.push('TOKEN_FILE='+ spec.env.tokenFile);
            createOptions.Env.push('TOKEN_DIR=/config');

            createOptions.Env.push('APP_PUBLISHER=' + appNameSplit[0]);
            createOptions.Env.push('APP_LOCAL_NAME=' + appNameSplit[1]);
            createOptions.Env.push('APP_PROTOCOL=' + spec.env.appProtocol);
            createOptions.Env.push('APP_SUFFIX=' + spec.env.appSuffix);
            createOptions.Env.push('TRUSTED_PUB_KEY_FILE=' +
                                   spec.env.trustedPubKeyFile);

            if (spec.env.debugApplication) {
                createOptions.Env.push('NODE_OPTIONS=' +
                                       spec.env.nodeDebugOptions);
                createOptions.Env.push('DEBUGGER=' + spec.env.debugApplication);
            }

            const props = JSON.parse(spec.env.appExtraProps);
            Object.keys(props).forEach(function(x) {
                var value = props[x];
                value = typeof value === 'string' ?
                    value :
                    JSON.stringify(value);
                createOptions.Env.push(x + '=' + value);
            });

            const expandDevices = function(devices) {
                return devices.map(function(x) {
                    return {
                        'PathOnHost': x,
                        'PathInContainer': x,
                        'CgroupPermissions': 'rwm'
                    };
                });
            };
            const hostConfig = {
                Privileged: spec.env.appPrivileged,
                NetworkMode: spec.env.netName,
                Devices: expandDevices(spec.env.appDevices)
            };

            if (spec.env.debugApplication) {
                hostConfig.PortBindings = hostConfig.PortBindings ?
                    hostConfig.PortBindings :
                    {};
                /*Note that NODE_OPTIONS="--inspect=0.0.0.0:<debuggerPort>"
                 * should match spec.env.debuggerPort
                 */
                createOptions.ExposedPorts = createOptions.ExposedPorts ?
                    createOptions.ExposedPorts :
                    {};
                createOptions.ExposedPorts['' + spec.env.debuggerPort +
                                           '/tcp'] = {};
                hostConfig.PortBindings['' + spec.env.debuggerPort + '/tcp'] =
                    [{'HostPort': '' + spec.env.debuggerPort,
                      'HostIp': '127.0.0.1'}]; // debug port only local loop
            }

            myUtils.mixin(hostConfig, extraHostConfig);
            hostConfig.Binds = (hostConfig.Binds ? hostConfig.Binds : []);
            hostConfig.Binds.push(spec.env.tokenDir + ':/config');
            createOptions.HostConfig = hostConfig;

            const job = docker.run(
                spec.env.image, cmdArray, null, createOptions, function (err) {
                    /* Container has finished, ensure that
                     * we are shutdown.
                     */
                    if (err) {
                        const msg = 'Container terminates with error:';
                        $._.$.log && $._.$.log.debug(
                            msg + myUtils.errToPrettyStr(err)
                        );
                    }
                    that.__ca_shutdown__(null, cb1);
                }
            );

            job.on('container', function(container) {
                $._.$.log && $._.$.log.debug('Container up, id:' +
                                             container.id);
                containerId = container.id;
                cb1(null);
            });

            job.on('stream', function(stream) {
                stream.setEncoding('utf8');
                if (outStream) {
                    stream.pipe(outStream, {end: true});
                } else {
                    stream.pipe(process.stdout); // don't close stdout
                }
            });
        };

        const super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    if (containerId) {
                        const containerIds = [containerId];
                        containerId = null;
                        utilManager.eliminateContainers($, containerIds, cb0);
                    } else {
                        cb0(null);
                    }
                }
            });
        };

        const p = new Promise((resolve) => {
            try {
                startContainer(function(err) {
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
