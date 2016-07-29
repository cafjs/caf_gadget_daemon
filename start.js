#!/usr/bin/env node
'use strict';
var daemon = require('./index.js');
var parseArgs = require('minimist');
var argv = parseArgs(process.argv.slice(2));
var spec = { env: {}};

var addOpt = function(x){
    if (argv[x]) {
        spec.env[x] = argv[x];
    }
};

addOpt('myId');
addOpt('tokenFile');
addOpt('appPublisher');
addOpt('appLocalName');
addOpt('appSuffix');
addOpt('appProtocol');
daemon.run([module], null, spec, function(err, top) {
    if (err) {
        // eslint-disable-next-line
        console.log('Error: ' + err);
    } else {
        // eslint-disable-next-line
        console.log('Starting gadget manager...');
        process.on('SIGTERM', function() {
            // eslint-disable-next-line
            console.log('Caught SIGTERM signal (stop container)');
            top.__ca_graceful_shutdown__(null, function(err) {
                // eslint-disable-next-line
                console.log('shutdown:' + (err ? err : 'OK'));
            });
        });
    }
});
