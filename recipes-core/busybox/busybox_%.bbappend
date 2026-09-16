FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# DISTRO_FEATURES sysvinit brings in oe-core's initscripts, which call applets
# poky-tiny's defconfig leaves out: uniq (populate-volatile.sh), pidof
# (pidofproc in /etc/init.d/functions), seq (swupdate's stop) and tr (mdev
# coldplug). bootmisc.sh compares /etc/timestamp with a 64-bit test and, with
# no RTC, sets the clock to it with "date MMDDhhmmYYYY.ss", which busybox only
# accepts with FEATURE_DATE_COMPAT. Merged over the defconfig by find_cfgs in
# busybox.inc.
SRC_URI += "file://ethernet-switch-os-initscripts.cfg"

# Applets nothing uses: the DHCP server with dumpleases, and the DHCPv6 client
# (IPv6 is not supported). udhcpc, the DHCPv4 client, stays.
SRC_URI += "file://ethernet-switch-os-dhcp.cfg"

# Replaces oe-core's /etc/init.d/mdev (same name, found first through
# FILESEXTRAPATHS). The only change: module coldplug is skipped when there is
# no module tree, which is always the case here -- the rtl83xx kernel is built
# without CONFIG_MODULES, and modprobe otherwise complains on every boot.
