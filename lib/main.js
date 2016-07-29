/*!
Copyright 2014 Hewlett-Packard Development Company, L.P.

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

var caf_iot = require('caf_iot');
var caf_comp = caf_iot.caf_components;
var myUtils = caf_comp.myUtils;

// module
exports.getModule = function() {
    return module;
};

exports.run = function(modules, jsonFile, spec, cb) {
    spec = spec || {};
    spec.name = spec.name || 'top';
    jsonFile = jsonFile || 'daemon.json';
    modules = modules || [];
    modules.push(module);
//    modules.push(caf_platform.getModule());
    caf_comp.load(null, spec, jsonFile, modules,
                  function(err, $) {
                      if (err) {
                          // eslint-disable-next-line
                          console.log('Error:' + myUtils.errToPrettyStr(err));
                          cb && cb(null);
                      } else {
                          $._.$.log && $._.$.log.debug('READY LAJSJSTTW343W');
                          cb && cb(err, $.top);
                      }
                  });
};
