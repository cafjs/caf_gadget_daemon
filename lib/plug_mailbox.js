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
 *  Receives instructions from another docker container by using a shared file.
 *
 * A less trusted app can delegate privileged actions, such as shutting down
 * the board, to the management daemon. Therefore, mandatory policies can be
 *  enforced to these actions.
 *
 *
 * @name caf_gadget_daemon/plug_mailbox
 * @namespace
 * @augments caf_components/gen_plug
 *
 */

var assert = require('assert');
var caf_iot =  require('caf_iot');
var caf_comp = caf_iot.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');


/**
 * Factory method for a plug that implements a mailbox with a shared file
 * between containers.
 *
 * The app container writes to this file, and the management daemon waits for
 *  file changes, and processes requests from the app.
 *
 * At any time the file contains at most one message, always in JSON format.
 * The app  overwrites this message without synchronization, and therefore,
 * messages could be lost.
 *
 * This is used with 'plug_nap' to  halt and restart the board from the app.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);

        $._.$.log && $._.$.log.debug('New Mailbox plug');

        var lastData = null;

        assert.equal(typeof spec.env.mailboxDir, 'string',
                     "'spec.env.mailboxDir' not a string");

        assert.equal(typeof spec.env.mailboxFile, 'string',
                     "'spec.env.mailboxFile' not a string");

        var fileName = path.resolve(spec.env.mailboxDir,
                                    spec.env.mailboxFile);
        mkdirp.sync(path.dirname(fileName));

        var handlerF = null;

        // create file if it doesn't exist, otherwise truncate
        var file = fs.openSync(fileName, 'w');
        fs.closeSync(file);

        var queue = async.queue(function(req, cb0) {
            if (handlerF) {
                handlerF(req, cb0);
            } else {
                $._.$.log && $._.$.log.debug('Ignoring request: No handler');
                cb0(null);
            }
        }, 1); // sequential

        fs.watch(fileName, {persistent: false, recursive: false},
                 function(event) {
                     if (event === 'change') {
                        fs.readFile(fileName, 'utf8',  function(err, data) {
                            try {
                                if (data !== lastData) { //debounce
                                    lastData = data;
                                    var cmd = JSON.parse(data);
                                    queue.push(cmd, function(err) {
                                        if (err) {
                                            $._.$.log &&
                                                $._.$.log
                                                .debug(myUtils
                                                       .errToPrettyStr(err));
                                        }
                                    });
                                }
                            } catch (ex) {
                                // ignore incomplete command
                            }
                        });
                     }
                 });

        /**
         * Register a handler to process mailbox messages.
         *
         * The type of the handler (caf.handler) is:
         *
         *  function(caf.json, caf.cb)
         *
         * and the callback 'caf.cb' is a tail call and should be called just
         * before returning.
         *
         * @param {caf.handler} handler A function to process mailbox messages.
         *
         */
        that.registerHandler = function(handler) {
            handlerF = handler;
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
