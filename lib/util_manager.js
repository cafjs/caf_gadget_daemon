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
 * Helper functions to manage apps.
 *
 *
 * @name caf_gadget_daemon/util_manager
 * @namespace
 *
 */
var caf_iot =  require('caf_iot');
var caf_comp = caf_iot.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;

var logAndContinue = function($, msg, containerId, cb) {
    return function(error, x) {
        if (error) {
            $._.$.log && $._.$.log.debug('Cannot ' + msg + ' in ' +
                                         containerId +
                                         ': ignoring exception  for ' +
                                         myUtils.errToPrettyStr(error));
            cb(null);
        } else {
            cb(error, x);
        }
    };
};

/**
 * Stops and removes all the containers with matching ids.
 *
 */
exports.eliminateContainers = function($, containerIds, cb) {
    var docker = $._.$.docker.cli;
    var eliminateOne = function(containerId, cb0) {
        var container = docker.getContainer(containerId);
        if (container) {
            async.series([
                function(cb1) {
                    // stopped containers return error...
                    container.stop(logAndContinue($, 'stop', containerId, cb1));
                },
                function(cb1) {
                    container.remove(logAndContinue($, 'remove', containerId,
                                                    cb1));
                }
            ], cb0);
        } else {
            cb0(null);
        }
    };

    async.map(containerIds, eliminateOne, cb);
};
var eliminateContainers = exports.eliminateContainers;

/**
 * Finds containers with a given name.
 *
 *
 *
 */
var findContainers = exports.findContainers = function($, name, cb) {
    var inArray = function(array, target) {
        return array.some(function(x) {
            return (x === target);
        });
    };
    var docker = $._.$.docker.cli;
    docker.listContainers({all: 1} , function(err, data) {
        if (err) {
            cb(err);
        } else {
            var ids = [];
            data.forEach(function(x) {
                if (inArray(x.Names, '/' + name)) {
                    ids.push(x.Id);
                }
            });
            cb(null, ids);
        }
    });
};

/**
 * Find and eliminate a container with a given name.
 *
 *
 *
 */
exports.eliminateByName = function($, name, cb) {
    findContainers($, name, function(err, containerIds) {
        if (err) {
            cb(err);
        } else {
            eliminateContainers($, containerIds, cb);
        }
    });
};
