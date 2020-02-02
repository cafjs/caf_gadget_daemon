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
 * A top level  supervisor component that assembles and manages the
 * framework from simpler components as described in `daemon.json`.
 *
 * @name iot_main
 * @namespace
 * @augments caf_components/gen_supervisor
 */
const caf_iot = require('caf_iot');
const caf_comp = caf_iot.caf_components;
const gen_sup = caf_comp.gen_supervisor;
const myUtils = caf_comp.myUtils;
const json_rpc = caf_iot.caf_transport.json_rpc;
const assert = require('assert');

/**
 * Factory method to create a supervisor component.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = async function($, spec) {
    try {
        const that = gen_sup.create($, spec);

        assert.equal(typeof spec.env.appPublisher, 'string',
                     "'spec.env.appPublisher' not a string");

        assert.equal(typeof spec.env.appLocalName, 'string',
                     "'spec.env.appLocalName' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        assert.equal(typeof spec.env.synchronousInit, 'boolean',
                     "'spec.env.synchronousInit' not a boolean");


        const appName = json_rpc.joinName(spec.env.appPublisher,
                                          spec.env.appLocalName);

        const appFullName = appName + '.' + spec.env.appSuffix;


        /**
         * Returns this application name, e.g., 'root-helloworld'
         *
         * @return {string} A  name for this app.
         *
         * @name iot_main#__ca_getAppName__
         * @function
         */
        that.__ca_getAppName__ = function() {
            return appName;
        };

        /**
         * Returns this application fully qualified name, e.g.,
         * 'root-helloworld.cafjs.com'
         *
         * @return {string} A fully qualified name for this app.
         *
         * @name iot_main#__ca_getAppFullName__
         * @function
         */
        that.__ca_getAppFullName__ = function() {
            return appFullName;
        };

        /**
         * Returns this application domain suffix, e.g., 'cafjs.com'
         *
         * @return {string} A domain suffix for this app.
         *
         * @name iot_main#__ca_getAppSuffix__
         * @function
         */
        that.__ca_getAppSuffix__ = function() {
            return spec.env.appSuffix;
        };

        /**
         * Returns the CA name, e.g., 'foo-device1'.
         *
         * @return {string} The CA name.
         *
         * @name iot_main#__ca_getName__
         * @function
         */
        that.__ca_getName__ = function() {
            return spec.env.myId;
        };

        if (spec.env['debugger']) {
            // activate debugger
            process.kill(process.pid, 'SIGUSR1');
        }
        var pendingShutdown = null;

        const notifyF = function(err, res) {
            if (err) {
                $._.$.log && $._.$.log.error('Top error:' +
                                             myUtils.errToPrettyStr(err));
                // eslint-disable-next-line
                console.log('Top error:' + myUtils.errToPrettyStr(err));
            } else {
                $._.$.log && $._.$.log.trace('Check OK:' +
                                              JSON.stringify(res));
            }
            if (pendingShutdown) {
                if (err && err.checkingForHang) {
                    $._.$.log &&
                        $._.$.log.warn('Waiting for graceful shutdown...');
                } else {
                    const p = pendingShutdown;
                    pendingShutdown = null;
                    that.__ca_shutdown__(p.data, p.cb);
                }
            }
        };

        /**
         * A graceful shutdown that waits until a pending checkup has finished.
         *
         * This is needed mostly for testing, where we want to cleanly
         * start/stop the platform in the same process.
         *
         * Otherwise, races between shutdown and checkup could bring back to
         *  life parts of the platform affecting other tests.
         *
         *  In production it is easier to shutdown the process and create
         *  a new one, since state is always checkpointed.
         *
         * @param {Object=} data
         * @param {caf.cb} cb0
         *
         * @name iot_main#__ca_graceful_shutdown__
         * @function
         */
        that.__ca_graceful_shutdown__ = function(data, cb0) {
            if (that.__ca_isShutdown__) {
                cb0(null);
            } else {
                pendingShutdown = {data: data, cb: cb0};
            }
        };

        const p = new Promise((resolve) => {
            try {
                if (spec.env.synchronousInit) {
                    that.__ca_start__(notifyF, function(err) {
                        if (err) {
                            resolve([err]);
                        } else {
                            resolve([null, that]);
                        }
                    });
                } else {
                    that.__ca_start__(notifyF);
                    resolve([null, that]);
                }
            } catch (err) {
                resolve([err]);
            }
        });
        return p;
    } catch (err) {
        return [err];
    }
};
