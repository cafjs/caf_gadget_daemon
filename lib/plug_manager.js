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
 * Manages a docker app.
 *
 *
 * @name caf_gadget_daemon/plug_manager
 * @namespace
 * @augments caf_components/gen_dynamic_container
 *
 */
var assert = require('assert');

var caf_comp = require('caf_components');
var myUtils = caf_comp.myUtils;
var genDynamicContainer = caf_comp.gen_dynamic_container;


/**
 * Factory method for a manager of apps.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        $._.$.log && $._.$.log.debug('New Manager plug');

        assert.equal(typeof(spec.env.__app_json__), 'string',
                     "'spec.env.__app_json__' is not a string");

        var that = genDynamicContainer.constructor($, spec);

        var super__ca_instanceChild__ = myUtils
            .superior(that, '__ca_instanceChild__');

        /**
         *  Creates an app if not already created.
         *
         * @param {Object=} data An optional hint on how to add the child.
         * @param {Object} specEnv An extra child description to override a
         * default one. At a minimum `specEnv.name` should define the name
         * for this app.
         * @param {caf.cb} cb A callback to return an error if I cannot
         * create the app.
         *
         * @name plug_manager#__ca_instanceChild__
         * @function
         */
        that.__ca_instanceChild__ = function(data, specEnv, cb0) {
            try {
                assert.equal(typeof(specEnv.name), 'string',
                     "'specEnv.name' is not a string");
                var desc = $._.$.loader
                    .__ca_loadDescription__(spec.env.__app_json__, true,
                                            specEnv);
                super__ca_instanceChild__(data, desc, cb0);
            } catch (err) {
                cb0(err);
            }
        };



        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
