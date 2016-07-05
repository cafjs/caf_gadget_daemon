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
 * Builds Docker images.
 *
 *
 * @name caf_gadget_daemon/plug_builder
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

var assert = require('assert');
var caf_iot =  require('caf_iot');
var caf_comp = caf_iot.caf_components;
var myUtils = caf_comp.myUtils;
var async =  caf_comp.async;
var genPlug = caf_comp.gen_plug;
var utilBuilder = require('./util_builder');
var fs = require('fs');
var path = require('path');

/**
 * Factory method  to build docker images.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
       var that = genPlug.constructor($, spec);

        $._.$.log && $._.$.log.debug('New Builder plug');

        assert.equal(typeof spec.env.buildDir, 'string',
                     "'spec.env.buildDir' not a string");

        assert.equal(typeof spec.env.dockerfileTemplate, 'string',
                     "'spec.env.dockerfileTemplate' not a string");

        assert.equal(typeof spec.env.dockerfilePrivilegedTemplate, 'string',
                     "'spec.env.dockerfilePrivilegedTemplate' not a string");

        var dir = (spec.env.dockerfileDir ? spec.env.dockerfileDir :
                   __dirname);
        var dockerfile =
                fs.readFileSync(path.join(dir, spec.env.dockerfileTemplate),
                                'utf8');
        var dockerfilePrivileged =
                fs.readFileSync(path.join(dir, spec.env
                                          .dockerfilePrivilegedTemplate),
                                'utf8');
        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        assert.equal(typeof spec.env.appFile, 'string',
                     "'spec.env.appFile' not a string");

        that.buildImage = function(name, meta, cb0) {
            var privileged = meta && meta.privileged;
            $._.$.log && $._.$.log.debug('Building image ' + name +
                                         ' privileged:' + privileged);
            var url = spec.env.appProtocol + '://' + name + '.' +
                    spec.env.appSuffix + '/' +  spec.env.appFile;
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
                        var file = (privileged ? dockerfilePrivileged :
                                    dockerfile);
                        utilBuilder.newImage($, spec.env.buildDir, file,
                                             url, name, etag, privileged, cb1);
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
            var url = spec.env.appProtocol + '://' + name + '.' +
                    spec.env.appSuffix + '/' +  spec.env.appFile;

            utilBuilder.getEtag($, url, function(err, etag) {
                if (err) {
                    cb0(err);
                } else {
                    cb0(null, etag !== oldEtag);
                }
            });
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
