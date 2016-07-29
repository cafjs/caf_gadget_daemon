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
 *
 *  A cron job that checks for application updates.
 *
 *
 * @name cron_updates
 * @namespace
 * @augments  caf_component/gen_cron
 */
var caf_iot = require('caf_iot');
var caf_comp = caf_iot.caf_components;
var myUtils = caf_comp.myUtils;
var genCron = caf_comp.gen_cron;


/**
 * Factory method to check for application updates.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genCron.constructor($, spec);

        // this function is bound as a method of 'that'
        var updateF = function() {
            $._.$.log &&
                $._.$.log.debug('Cron ' + spec.name + ' waking up');

            $._.$.appMgr.refreshState(function(err) {
                if (err) {
                    $._.$.log && $._.$.log.debug('pulser_cron ' +
                                         myUtils.errToPrettyStr(err));
                } else {
                    $._.$.log && $._.$.log.debug('update pulsing done.');
                }
            });
        };
        that.__ca_start__(updateF);

        $._.$.log && $._.$.log.debug('New update cron job');
        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
