SUMMARY = "Button and switch actions for Ethernet Switch OS"
DESCRIPTION = "triggerhappy rules for boards with buttons or DIP switches: \
KEY_RESTART reboots when released within 5 seconds and resets to the factory \
default when held longer; BTN_0..BTN_4 are logged to syslog."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = " \
    file://ethernet-switch-os.conf \
    file://ethernet-switch-os-reset-key \
"

S = "${UNPACKDIR}"

inherit allarch

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${sysconfdir}/triggerhappy/triggers.d ${D}${sbindir}
    install -m 0644 ${S}/ethernet-switch-os.conf ${D}${sysconfdir}/triggerhappy/triggers.d/
    install -m 0755 ${S}/ethernet-switch-os-reset-key ${D}${sbindir}/
}

# The factory reset deletes the saved configuration of clixon-switch.
RDEPENDS:${PN} = "triggerhappy busybox"
