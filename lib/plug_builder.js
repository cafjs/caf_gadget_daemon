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
        var dir = (spec.env.dockerfileDir ? spec.env.dockerfileDir :
                   __dirname);
        var dockerfile =
                fs.readFileSync(path.join(dir, spec.env.dockerfileTemplate),
                                'utf8');
        assert.equal(typeof spec.env.appProtocol, 'string',
                     "'spec.env.appProtocol' not a string");

        assert.equal(typeof spec.env.appSuffix, 'string',
                     "'spec.env.appSuffix' not a string");

        assert.equal(typeof spec.env.appFile, 'string',
                     "'spec.env.appFile' not a string");

        var last = null;

        that.buildImage = function(name, cb0) {
            $._.$.log && $._.$.log.debug('Building image ' + name);
            var url = spec.env.appProtocol + '://' + name + '.' +
                    spec.env.appSuffix + '/' +  spec.env.appFile;
            var etag = null;
            async.waterfall([
                function(cb1) {
                    utilBuilder.getEtag($, url, cb1);
                },
                function(tag, cb1) {
                    etag = tag;
                    utilBuilder.getImageId($, name, etag, cb1);
                },
                function(id, cb1) {
                    if (id) {
                        cb1(null, id);
                    } else {
                        utilBuilder.newImage($, spec.env.buildDir, dockerfile,
                                             url, name, etag, cb1);
                    }
                }
            ], function(err, id) {
                if (err) {
                    cb0(err);
                } else {
                    last = {name : name, etag: etag, id: id, url: url};
                    cb0(null, id);
                }
            });
        };

        that.hasChanged = function(cb0) {
            if (last) {
                utilBuilder.getEtag($, last.url, function(err, etag) {
                    if (err) {
                        cb0(err);
                    } else {
                        cb0(null, etag !== last.etag);
                    }
                });
            } else {
                cb0(null, false);
            }
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
