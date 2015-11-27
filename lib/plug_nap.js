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
 *  Uses an i2c RTC module (i.e., ds1337 in the WittyPi) to schedule a board
 * restart after a complete shutdown.
 *
 * The purpose is to save energy. The RTC module can work for years with
 * a reasonable battery, and the annoying disappearance of the device can
 * be compensated by the permanent presence of its Cloud Assistant, that also
 * controls when the device should be up.
 *
 * @name caf_gadget_daemon/plug_nap
 * @namespace
 * @augments caf_components/gen_plug
 *
 */
var assert = require('assert');
var i2c = require('i2c');

var caf_comp = require('caf_components');
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var exec = require('child_process').exec;

var DS1337_TIME_ADDRESS = 0x00;
var DS1337_TIME_BYTES = 0x07;
var DS1337_ALARM_CONFIG_ADDRESS = 0x0E;
var DS1337_ALARM_CONFIG = 0x07; //both alarms active, only first one used.
var DS1337_ALARM_ADDRESS = 0x07; // first alarm

var MIN_WAKEUP_SEC = 15; // give enough time to shutdown properly

/**
 * Factory method for a plug that controls restart after a complete shutdown.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);

        $._.$.log && $._.$.log.debug('New Nap plug');

        assert.equal(typeof spec.env.deviceAddress, 'string',
                     "'spec.env.deviceAddress' not a string");
        var deviceAddress = parseInt(spec.env.deviceAddress);

        assert.equal(typeof spec.env.deviceRTC, 'string',
                     "'spec.env.deviceRTC' not a string");

        assert.equal(typeof spec.env.debugRTC, 'boolean',
                     "'spec.env.debugRTC' not a boolean");

        var rtc =  new i2c(deviceAddress, {device: spec.env.deviceRTC});

        var BCDToDec = function(x, mask) {
            x = (mask ? (x & mask) : x);
            return (x >> 4)*10 + (x & 0x0F);
        };

        var decToBCD = function(x) {
            return Math.floor(x/10) << 4 | x%10;
        };

        var setDS1337Time = function(t, cb0) {
            var bytes = [t.getUTCSeconds(),
                         t.getUTCMinutes(),
                         t.getUTCHours(),
                         t.getUTCDay() + 1,
                         t.getUTCDate(),
                         t.getUTCMonth() + 1,
                         t.getUTCFullYear() -2000]
                    .map(decToBCD);

            rtc.writeBytes(DS1337_TIME_ADDRESS, bytes, cb0);
        };

        var getDS1337Time = function(cb0) {
            rtc.readBytes(DS1337_TIME_ADDRESS, DS1337_TIME_BYTES,
                          function(err, res) {
                              //only 24h mode supported
                              if (res[2] & 0x40) {
                                  var er = new Error('12h mode not supported');
                                  er.res = res;
                                  cb0(er);
                              } else {
                                  var sec = BCDToDec(res[0]);
                                  var min =  BCDToDec(res[1]);
                                  var hour = BCDToDec(res[2], 0x3F);
                                  var day = BCDToDec(rtc[3]) -1;// sunday is 0
                                  var mday = BCDToDec(res[4]);
                                  var month = BCDToDec(res[5], 0x1F) -1;
                                  var year = BCDToDec(res[6]) + 2000;
                                  var date = Date.UTC(year, month,
                                                      mday, hour, min, sec);
                                  cb0(null, new Date(date));
                              }
                          });
        };

        var activateAlarm = function(cb0) {
            var bytes = [];
            bytes[0] = DS1337_ALARM_CONFIG;
            var cb1 = function(err) {
                // wrap for async.waterfall
                cb0(err, null);
            };
            rtc.writeBytes(DS1337_ALARM_CONFIG_ADDRESS, bytes, cb1);
        };

        var setStartupAlarm = function(date, hour, min, sec, cb0) {
            var bytes = [];
            bytes[0] = decToBCD(sec);
            bytes[1] = decToBCD(min);
            bytes[2] = decToBCD(hour);
            bytes[3] = decToBCD(date);
            rtc.writeBytes(DS1337_ALARM_ADDRESS, bytes, cb0);
        };

        var doHalt = function(cb0) {
            var cmd = (spec.env.debugRTC ? 'echo shutting_down' :
                       'sudo shutdown -h now');
            exec(cmd, function (error, stdout, stderr) {
                $._.$.log && $._.$.log.debug('stdout: ' + stdout);
                $._.$.log && $._.$.log.debug('stderr: ' + stderr);
                if (error !== null) {
                    cb0(error);
                } else {
                    cb0(null);
                }
            });
        };

        /**
         * Halts the board, scheduling a late restart with the RTC timer.
         *
         * @param {number} afterSec Seconds before the board restarts.
         * @param {caf.cb} cb0 A callback to notify an error.
         *
         */
        that.haltAndRestart = function(afterSec, cb0) {
            var hwNow;
            try {
                async.waterfall([
                    getDS1337Time,
                    function(now, cb1) {
                        hwNow = now;
                        activateAlarm(cb1);
                    },
                    function(_ignore, cb1) {
                        var newTime = hwNow.getTime() + 1000* afterSec;
                        var newQ = new Date(newTime);
                        var mday = newQ.getUTCDate();
                        var hour = newQ.getUTCHours();
                        var min = newQ.getUTCMinutes();
                        var sec = newQ.getUTCSeconds();
                        setStartupAlarm(mday, hour, min, sec, cb1);
                    }
                ], function(err) {
                    if (err) {
                        cb0(err);
                    } else {
                        $._.$.log && $._.$.log.debug('Halting!!!');
                        doHalt(cb0);
                    }
                });
            } catch(err) {
                cb0(err);
            }
        };

        $._.$.mailbox.registerHandler(function(cmd, cb0) {
            if (cmd.op === 'haltAndRestart') {
                try {
                    var when = (new Date(cmd.when)).getTime();
                    var now = (new Date()).getTime();
                    if (now < when) {
                        var afterSec = Math.floor((when-now)/1000);
                        afterSec = (afterSec < MIN_WAKEUP_SEC ?
                                    MIN_WAKEUP_SEC : afterSec);
                        that.haltAndRestart(afterSec, cb0);
                    } else {
                        $._.$.log &&
                            $._.$.log.debug('Ignoring late halt command: ' +
                                            cmd);
                        cb0(null);
                    }
                } catch(err) {
                    cb0(err);
                }
            } else {
                var err = new Error('Unknown command: ' + cmd);
                cb0(err);
            }
        });

        /* Assumed system time is OK by now, otherwise certificate
         * verification would have already failed.
         *
         * The RTC clock is mostly used for setting alarms with relative timing,
         *  and we use NTP or other ntp-like protocols for time sync.
         */
        setDS1337Time(new Date(), function(err) {
            if (err) {
                cb(err);
            } else {
                cb(null, that);
            }
        });
    } catch (err) {
        cb(err);
    }
};
