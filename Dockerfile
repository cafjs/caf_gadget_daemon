# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants Raspberry Pi 2 device daemon (armv6)
# TO_BUILD:       cafjs mkImage . gcr.io/cafjs-k8/root-rpidaemon
# TO_RUN:         docker run -d --name=root-rpidaemon --restart=always -e MY_ID=foo-device1  -e CONFIG_VOLUME=/config -v /var/run/docker.sock:/var/run/docker.sock   -v /config:/config gcr.io/cafjs-k8/root-rpidaemon
#
#   and you need the token for root-gadget#foo-device1 in /config/token

FROM gcr.io/cafjs-k8/root-rpi2armhf

#do not use 'npm run start' because it does not propagate SIGTERM
ENTRYPOINT [ "./start.js"]
