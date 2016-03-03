#!/bin/sh
echo 1 > /proc/sys/kernel/sysrq
#sync, unmount, and shutdown (still not completely safe because processes running)
echo s > /proc/sysrq-trigger
echo u > /proc/sysrq-trigger
echo o  > /proc/sysrq-trigger
