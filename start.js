#!/usr/bin/env node
var daemon = require('./index.js');
var parseArgs = require('minimist');
var argv = parseArgs(process.argv.slice(2));
var spec = { env : {}};

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
               console.log('Error: ' + err);
           } else {
               console.log('Starting gadget manager...');
           }
       });
