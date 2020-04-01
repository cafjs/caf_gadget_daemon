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
 * Builds Docker images.
 *
 *
 * @name caf_gadget_daemon/plug_builder
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

const assert = require('assert');
const caf_iot = require('caf_iot');
const caf_comp = caf_iot.caf_components;
const async = caf_comp.async;
const genPlug = caf_comp.gen_plug;
const utilBuilder = require('./util_builder');
const fs = require('fs');
const path = require('path');

/**
 * Factory method  to build docker images.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);

        $._.$.log && $._.$.log.debug('New Builder plug');

        assert.equal(typeof spec.env.buildDir, 'string',
                     "'spec.env.buildDir' not a string");

        assert.equal(typeof spec.env.dockerfileTemplate, 'string',
                     "'spec.env.dockerfileTemplate' not a string");

        assert.equal(typeof spec.env.dockerfilePrivilegedTemplate, 'string',
                     "'spec.env.dockerfilePrivilegedTemplate' not a string");

        const dir = spec.env.dockerfileDir ?
            spec.env.dockerfileDir :
            __dirname;

        const dockerfile =
                fs.readFileSync(path.join(dir, spec.env.dockerfileTemplate),
                                'utf8');
        const dockerfilePrivileged = fs.readFileSync(
            path.join(dir, spec.env.dockerfilePrivilegedTemplate), 'utf8'
        );
        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        assert.equal(typeof spec.env.appFile, 'string',
                     "'spec.env.appFile' not a string");

        assert.equal(typeof spec.env.isRegistryPrivate, 'boolean',
                     "'spec.env.isRegistryPrivate' not a boolean");

        var authConfig = null;
        var registryConfig = null;
        if (spec.env.isRegistryPrivate) {
            assert.equal(typeof spec.env.registryUsername, 'string',
                         "'spec.env.registryUsername' not a string");
            assert.equal(typeof spec.env.registryPassword, 'string',
                         "'spec.env.registryPassword' not a string");
            assert.equal(typeof spec.env.registryAddress, 'string',
                         "'spec.env.registryAddress' not a string");

            authConfig = {
                username: spec.env.registryUsername,
                password: spec.env.registryPassword,
                auth: '',
                email: 'foo@cafjs.com',
                serveraddress: spec.env.registryAddress
            };

            registryConfig = {};
            registryConfig[spec.env.registryAddress] = {
                username: spec.env.registryUsername,
                password: spec.env.registryPassword
            };
        }

        that.buildImage = function(name, meta, cb0) {
            const privileged = meta && meta.privileged;
            $._.$.log && $._.$.log.debug('Building image ' + name +
                                         ' privileged:' + privileged);
            const url = spec.env.appProtocol + '://' + name + '.' +
                      spec.env.appSuffix + '/' + spec.env.appFile;
            var etag = null;
            async.waterfall([
                function(cb1) {
                    utilBuilder.getEtag($, url, cb1);
                },
                function(tag, cb1) {
                    etag = tag;
                    utilBuilder.getImageId($, name, etag, privileged, cb1);
                },
                function(id, cb1) {
                    if (id) {
                        cb1(null, id);
                    } else {
                        const file = privileged ?
                            dockerfilePrivileged :
                            dockerfile;
                        utilBuilder.newImage($, spec.env.buildDir, file,
                                             url, name, etag, privileged,
                                             authConfig, registryConfig, cb1);
                    }
                }
            ], function(err, id) {
                if (err) {
                    cb0(err);
                } else if (!id) {
                    cb0(new Error('Missing image id'));
                } else {
                    cb0(null, {etag: etag, id: id});
                }
            });
        };

        that.hasEtagChanged = function(name, oldEtag, cb0) {
            const url = spec.env.appProtocol + '://' + name + '.' +
                    spec.env.appSuffix + '/' + spec.env.appFile;

            utilBuilder.getEtag($, url, function(err, etag) {
                if (err) {
                    cb0(err);
                } else {
                    cb0(null, etag !== oldEtag);
                }
            });
        };

        return [null, that];
    } catch (err) {
        return [err];
    }
};
