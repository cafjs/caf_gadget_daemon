# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF device management daemon

A daemon running in the device that connects to a CA (see `caf_gadget`) to receive instructions and security tokens to instantiate applications. 

An application is always run in a Docker container, with an image built in the device itself.
