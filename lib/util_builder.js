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
 * Helper functions to build images
 *
 *
 * @name caf_gadget_daemon/util_builder
 * @namespace
 *
 */

var assert = require('assert');
var caf_comp = require('caf_components');
var myUtils = caf_comp.myUtils;
var async =  caf_comp.async;
var request = require('request');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var tar = require('tar');
var zlib = require('zlib');
var fstream = require('fstream');

var fs = require('fs');
var path =require('path');

var IMAGE_PREFIX = 'localhost.localdomain:5000/';

var callJustOnce = function($, cb) {
    return myUtils.callJustOnce(function(err, data) {
        $._.$.log && $._.$.log.debug('Ignore Call >1: err:' +
                                     myUtils.errToPrettyStr(err) +
                                     ' data:' + JSON.stringify(data));
    }, cb);
};

var getEtag = exports.getEtag = function($, url, cb0) {
    var cb1 = callJustOnce($, cb0);
    request
        .head(url)
        .on('error', function(err) {
            cb1(err);
        })
        .on('response', function(response) {
            if (response.statusCode === 200) {
                var etag = response.headers.etag;
                if (!etag) {
                    cb1(new Error('No etag'));
                } else {
                    etag = etag.split('"')[1];
                    cb1(null, etag);
                }
            } else {
                var error = new Error('Cannot get tar file header');
                error.status = response.statusCode;
                cb1(error);
            }
        });
};

var imgName = exports.imgName = function(name, etag) {
    return IMAGE_PREFIX + name + ':' + etag;
};

var getImageId = exports.getImageId = function($, name, etag, cb0) {
    var imageName = imgName(name, etag);
    var id = null;
    $._.$.docker.cli.listImages(function(err, data) {
        if (err) {
            cb0(err);
        } else {
            data.some(function(x) {
                var tags = x.RepoTags;
                return tags.some(function(y) {
                    if (y === imageName) {
                        id = x.Id;
                        return true;
                    } else {
                        return false;
                    }
                });
            });
            cb0(null, id);
        }
    });
};

var newImage = exports.newImage = function($, dir, dockerfile, url, name, etag,
                                           cb0) {
    async.series([
        function(cb1) {
            rimraf(dir, cb1);
        },
        function(cb1) {
            rimraf(dir + '.tar', cb1);
        },
        function(cb1) {
            mkdirp(dir, cb1);
        },
        function(cb1) {
            fs.writeFile(path.join(dir, 'Dockerfile'), dockerfile, cb1);
        },
        function(cb1) {
            var cb2 = callJustOnce($, cb1);
            var unzip = zlib.createGunzip();
            var extract = tar.Extract({
                path: dir,
                strip: 0
            });
            request
            .get(url)
            .on('error', function(err) {
                cb2(err);
            })
            .pipe(unzip).pipe(extract);

            unzip.on('error', cb2);

            extract.on('error', cb2);

            extract.on('finish', function() {
                cb2(null);
            });
        },
        function(cb1) {
            fs.writeFile(path.join(dir, 'package', 'Dockerfile'), dockerfile,
                         cb1);
        },
        function(cb1) {
            var cb2 = callJustOnce($, cb1);
            var dirDest = fs.createWriteStream(dir + '.tar');
            dirDest.on('error', cb2);
            var packer = tar.Pack({ noProprietary: true , fromBase: true});
            packer.on('error', cb2);
            fstream.Reader({ path: path.join(dir, 'package'),
                             type: "Directory" })
                .on('error', cb2)
                .pipe(packer)
                .pipe(dirDest);
            dirDest.on('finish', function() {
                cb2(null);
            });
        },
        function(cb1) {
            $._.$.log && $._.$.log.debug('Building Docker image ' +
                                         imgName(name, etag));
            var docker = $._.$.docker.cli;
            docker.buildImage(dir + '.tar', {t : imgName(name, etag)},
                              function(err, stream) {
                                  if (err) {
                                      cb1(err);
                                  } else {
                                      var onFinished = function(err, output) {
                                          if (err) {
                                              err.output = output;
                                              cb1(err);
                                          } else {
                                              $._.$.log &&
                                                  $._.$.log.debug(output);
                                              cb1(null);
                                          }
                                      };
                                      docker.modem.followProgress(stream,
                                                                  onFinished);
                                  }
                              });
        }
    ], function(err) {
        if (err) {
            cb0(err);
        } else {
            getImageId($, name, etag, cb0);
        }
    });
};
