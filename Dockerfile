# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants Raspberry Pi 2 device daemon (armv7)
# TO_BUILD:       docker build --rm -t registry.cafjs.com:32000/root-rpidaemon .
# TO_RUN:         docker run -e MY_ID=foo-device1 -v /var/run/docker.sock:/var/run/docker.sock -v /usr/bin/docker:/bin/docker -v /config:/config registry.cafjs.com:32000/root-rpidaemon
#

FROM registry.cafjs.com:32000/root-rpi2armhf


