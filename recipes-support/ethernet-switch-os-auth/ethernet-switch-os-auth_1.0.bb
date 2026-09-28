SUMMARY = "Admin password and factory reset for Ethernet Switch OS"
DESCRIPTION = "ethernet-switch-os-set-password sets the password of the admin \
account cli in /etc/shadow and copies its hash to lighttpd's htpasswd for the \
web login. /etc/ethernet-switch-os/setup-required marks the first-login setup \
until then. ethernet-switch-os-factory-reset marks the data partition for \
erasing by the BSP's overlay-init and reboots. clixon-switch's set-password \
and factory-reset RPCs run both scripts."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = " \
    file://ethernet-switch-os-set-password \
    file://ethernet-switch-os-factory-reset \
    file://setup-required \
"

S = "${UNPACKDIR}"

inherit allarch

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${sbindir} ${D}${sysconfdir}/ethernet-switch-os
    install -m 0755 ${S}/ethernet-switch-os-set-password ${D}${sbindir}/
    install -m 0755 ${S}/ethernet-switch-os-factory-reset ${D}${sbindir}/
    install -m 0644 ${S}/setup-required ${D}${sysconfdir}/ethernet-switch-os/
}

# busybox: awk, mktemp, stty, setsid, logger. shadow: chpasswd. lighttpd: the
# group the htpasswd file belongs to.
RDEPENDS:${PN} = "busybox shadow lighttpd"
