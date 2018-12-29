#!/bin/sh

#dockerRun <foo-device1> [</home/something/mytoken>] where the second arg is
#  optional if token already copied.


mkdir -p /config

if [ $# -eq 2 ]
then
    cp $2 /config/token
fi

# To really stop it docker rm -f <containerID>, otherwise restarts after boot
docker run -d --name=root-rpidaemon --restart=always -e MY_ID=$1 -v /var/run/docker.sock:/var/run/docker.sock  -v /config:/config  -e CONFIG_VOLUME=/config gcr.io/cafjs-k8/root-rpidaemon
