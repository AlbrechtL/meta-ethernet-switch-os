FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# The Debian init script needs /lib/lsb/init-functions and /lib/init/vars.sh,
# neither of which exists on poky-tiny, and runs thd as "nobody", which cannot
# reboot. Replace it with one for busybox.
SRC_URI += "file://triggerhappy.init"

do_install:append() {
    install -m 0755 ${UNPACKDIR}/triggerhappy.init ${D}${sysconfdir}/init.d/triggerhappy
}
