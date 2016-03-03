#!/bin/sh
echo 1 > /proc/sys/kernel/sysrq
#sync, unmount, and shutdown (still not completely safe because processes running)
echo s > /proc/sysrq-trigger
/bin/sleep 1
echo u > /proc/sysrq-trigger
/bin/sleep 1
echo o  > /proc/sysrq-trigger
