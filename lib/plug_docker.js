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
 * Connects with a local Docker daemon.
 *
 *
 * @name caf_gadget_daemon/plug_docker
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

const assert = require('assert');
const Docker = require('dockerode');
const caf_iot = require('caf_iot');
const caf_comp = caf_iot.caf_components;
const genPlug = caf_comp.gen_plug;

/**
 * Factory method for a connection to the local Docker daemon.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);

        $._.$.log && $._.$.log.debug('New Docker plug');


        assert.equal(typeof spec.env.dockerSocket, 'string',
                     "'spec.env.dockerSocket' not a string");

        const docker = new Docker({socketPath: spec.env.dockerSocket});

        that.cli = docker;

        return [null, that];
    } catch (err) {
        return [err];
    }
};
