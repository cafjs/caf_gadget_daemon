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
 * Helper functions to build images
 *
 *
 * @name caf_gadget_daemon/util_builder
 * @namespace
 *
 */

const caf_iot = require('caf_iot');
const caf_comp = caf_iot.caf_components;
const myUtils = caf_comp.myUtils;
const async = caf_comp.async;
const request = require('request');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const tar = require('tar');
const concatStream = require('concat-stream');
const crypto = require('crypto');

const fs = require('fs');
const path =require('path');

const IMAGE_PREFIX = 'localhost.localdomain:5000/';
const PRIVILEGED = 'privileged';

const callJustOnce = function($, cb) {
    return myUtils.callJustOnce(function(err, data) {
        $._.$.log && $._.$.log.debug('Ignore Call >1: err:' +
                                     myUtils.errToPrettyStr(err) +
                                     ' data:' + JSON.stringify(data));
    }, cb);
};

exports.getEtag = function($, url, cb0) {
    const cb1 = callJustOnce($, cb0);
    request
        .head(url)
        .on('error', function(err) {
            cb1(err);
        })
        .on('response', function(response) {
            if (response.statusCode === 200) {
                let etag = response.headers.etag;
                if (!etag) {
                    cb1(new Error('No etag'));
                } else {
                    etag = etag.split('"')[1];
                    cb1(null, etag);
                }
            } else {
                const error = new Error('Cannot get tar file header');
                error.status = response.statusCode;
                cb1(error);
            }
        });
};

const imgName = function(name, etag, privileged) {
    etag = etag.replace(/[+/]/g, '0'); //docker tags cannot contain all base64
    return IMAGE_PREFIX + name + ':' + etag + (privileged ? PRIVILEGED : '');
};

const getImageId = exports.getImageId = function($, name, etag, privileged,
                                                 cb0) {
    const imageName = imgName(name, etag, privileged);
    let id = null;
    $._.$.docker.cli.listImages(function(err, data) {
        if (err) {
            cb0(err);
        } else {
            data.some(function(x) {
                const tags = x.RepoTags;
                return tags && tags.some(function(y) {
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

const hashMatchesEtag = function(hash, etag) {
    const splitEtag = etag.split('-');
    if (splitEtag.length === 1) {
        etag = splitEtag[0];
    } else {
        etag = splitEtag[1];
    }
    return (hash === etag);
};

exports.newImage = function($, dir, dockerfile, url, name, etag,
                            privileged, auth, regConfig, cb0) {
    async.series([
        function(cb1) {
            rimraf(dir, cb1);
        },
        function(cb1) {
            rimraf(dir + '.tgz', cb1);
        },
        function(cb1) {
            mkdirp(dir, cb1);
        },
        function(cb1) {
            var hashValue = null;
            const cb2 = callJustOnce($, cb1);
            const stream = request
                .get(url)
                .on('error', err => cb2(err));

            const hash = crypto.createHash('md5');
            stream.pipe(concatStream(function(data) {
                // assume small file that fits in memory
                hashValue = hash.update(data, 'utf8').digest('base64')
                    .replace(/=+$/, '');

            }));

            const extract = tar.extract({gzip: true, cwd: dir, strip: 0});
            stream.pipe(extract);

            extract.on('error', cb2);

            extract.on('finish', function() {
                if (hashMatchesEtag(hashValue, etag)) {
                    cb2(null);
                } else {
                    const err = new Error('Invalid hash');
                    err.hash = hashValue;
                    err.etag = etag;
                    cb2(err);
                }
            });
        },
        function(cb1) {
            fs.writeFile(path.join(dir, 'Dockerfile'), dockerfile, cb1);
        },
        function(cb1) {
            fs.writeFile(path.join(dir, 'app', 'Dockerfile'), dockerfile, cb1);
        },
        function(cb1) {
            const cb2 = callJustOnce($, cb1);
            const dirDest = fs.createWriteStream(dir + '.tgz');
            dirDest
                .on('error', cb2)
                .on('finish', function() {cb2(null);});
            tar.create({gzip: true, cwd: dir}, ['.']).pipe(dirDest);
        },
        function(cb1) {
            $._.$.log && $._.$.log.debug('Building Docker image ' +
                                         imgName(name, etag, privileged));
            const docker = $._.$.docker.cli;
            const options = {
                t: imgName(name, etag, privileged)
            };
            if (auth && regConfig) {
                options.authconfig = auth;
                options.registryconfig = regConfig;
            }
            docker.buildImage(dir + '.tgz', options, function(err, stream) {
                if (err) {
                    cb1(err);
                } else {
                    const onFinished = function(err, output) {
                        if (err) {
                            const error = new Error('Build error');
                            error.output = output;
                            error.err = err;
                            cb1(error);
                        } else {
                            cb1(null);
                        }
                    };
                    const onProgress = function(event) {
                        $._.$.log && $._.$.log.debug(event.stream);
                    };
                    docker.modem.followProgress(stream, onFinished, onProgress);
                }
            });
        }
    ], function(err) {
        if (err) {
            cb0(err);
        } else {
            getImageId($, name, etag, privileged, cb0);
        }
    });
};
