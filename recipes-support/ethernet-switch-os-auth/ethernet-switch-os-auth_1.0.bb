SUMMARY = "Admin account and factory reset for Ethernet Switch OS"
DESCRIPTION = "The image has no admin account. ethernet-switch-os-set-password \
creates it in the first-login setup, with a name the user chooses and UID \
1000, and later sets its password; it copies the hash from /etc/shadow to \
lighttpd's htpasswd for the web login. /etc/ethernet-switch-os/setup-required \
marks the first-login setup until then. ethernet-switch-os-factory-reset \
marks the data partition for erasing by the BSP's overlay-init and reboots. \
clixon-switch's set-password and factory-reset RPCs run both scripts. The \
init script keeps the admin account cli of older firmware after an update."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = " \
    file://ethernet-switch-os-set-password \
    file://ethernet-switch-os-factory-reset \
    file://setup-required \
    file://ethernet-switch-os-auth.init \
"

S = "${UNPACKDIR}"

inherit allarch update-rc.d

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${sbindir} ${D}${sysconfdir}/ethernet-switch-os ${D}${sysconfdir}/init.d
    install -m 0755 ${S}/ethernet-switch-os-set-password ${D}${sbindir}/
    install -m 0755 ${S}/ethernet-switch-os-factory-reset ${D}${sbindir}/
    install -m 0644 ${S}/setup-required ${D}${sysconfdir}/ethernet-switch-os/
    install -m 0755 ${S}/ethernet-switch-os-auth.init ${D}${sysconfdir}/init.d/ethernet-switch-os-auth
}

# Before dropbear (10) and the clixon backend (05).
INITSCRIPT_NAME = "ethernet-switch-os-auth"
INITSCRIPT_PARAMS = "defaults 04"

# busybox: awk, mktemp, stty, setsid, logger. shadow: useradd, userdel,
# chpasswd. lighttpd: the group the htpasswd file belongs to. The users group
# (base-passwd) and the clicon group (clixon) are the admin account's.
RDEPENDS:${PN} = "busybox shadow lighttpd"
