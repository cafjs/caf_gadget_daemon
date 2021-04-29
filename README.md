# Caf.js

Co-design cloud assistants with your web app and IoT devices.

See https://www.cafjs.com

## Device Management Daemon

A daemon running in the device that connects to a CA (see `caf_gadget`) to instantiate applications and install security tokens.

Applications always run in Docker containers, with the image built in the device itself to improve portability.
