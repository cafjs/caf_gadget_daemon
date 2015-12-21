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
 * Manages Docker networks.
 *
 *
 * @name caf_gadget_daemon/plug_network
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

var assert = require('assert');
var caf_iot =  require('caf_iot');
var caf_comp = caf_iot.caf_components;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;

/**
 * Factory method for managing Docker networks.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);
        var network = null;
        
        $._.$.log && $._.$.log.debug('New network plug');

        assert.equal(typeof spec.env.netName, 'string',
                     "'spec.env.netName' not a string");
        
        assert.equal(typeof spec.env.alreadyCreated, 'boolean',
                     "'spec.env.alreadyCreated' not a boolean");

        if (spec.env.alreadyCreated) {
            $._.$.docker.cli.listNetworks(function(err, all) {
                if (err) {
                    cb(err);
                } else {
                    var id = null;
                    all.forEach(function(x) {
                        if (x.Name ===  spec.env.netName) {
                            id = x.Id;
                        }
                    });
                    if (id) {
                        network = $._.$.docker.cli.getNetwork(id);
                        cb(null, that);
                    } else {
                        var error = new Error('Network does not exist');
                        error.netName = spec.env.netName;
                        cb(error);
                    }
                }
            });
        } else {
            $._.$.docker.cli.createNetwork({
                "name" : spec.env.netName,
                "driver":"bridge"
            }, function(err, net) {
                if (err) {
                    cb(err);
                } else {
                    network = net;
                    cb(null, that);
                }
            });
        }
        
        that.getName = function() {
            return spec.env.netName;
        };

        that.getID = function() {
            return (network ? network.id : null);
        };
        
        that.connect = function(containerId, cb0) {
            if (network) {
                network.connect({'container' : containerId}, cb0);
            } else {
                cb0(new Error('no network'));
            }            
        };
                                       
        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err, res) {
                if (err) {
                    cb0(err);
                } else {
                    if (network && (!spec.env.alreadyCreated)) {
                        network.remove(function(err) {
                            network = null;
                            cb0(err);
                        });
                    } else {
                        network = null;
                        cb0(null);
                    }
                }
            });
        };

    } catch (err) {
        cb(err);
    }
};
