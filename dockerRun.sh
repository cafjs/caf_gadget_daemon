#!/bin/bash

#dockerRun <foo-device1> [</home/something/mytoken>] where the second arg is 
#  optional if token already copied.


mkdir -p /control
mkdir -p /config

if [ $# -eq 2 ]
then
    cp $2 /config/token 
fi

# need --net=host to be able to shutdown the host with systemd
# To really stop it docker rm -f <containerID>, otherwise restarts after boot
docker run -d --net=host --device=/dev/i2c-1 --name=root-rpidaemon --restart=always -e MY_ID=$1 --privileged -v /var/run/docker.sock:/var/run/docker.sock -v /usr/bin/docker:/bin/docker -v /control:/control -v /config:/config registry.cafjs.com:32000/root-rpidaemon
