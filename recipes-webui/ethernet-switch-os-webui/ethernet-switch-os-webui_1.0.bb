SUMMARY = "Status and settings web page for the switch"
DESCRIPTION = "Static HTML, CSS and JavaScript page, served at / by \
clixon_restconf (clixon's http-data) on the same origin as /restconf. It shows \
the system state, the routed VLAN interfaces with their addresses and DHCP \
lease, the ports, the VLANs or port-based groups, spanning tree and SNMP, \
refreshed every 5 seconds, and changes them over RESTCONF: port, VLAN, \
management address, spanning tree, SNMP user and system settings, applied to \
running and kept once saved to startup. SNMP keys are localized in the \
browser. Links to the SWUpdate web UI on port 8080. Without authentication, \
like RESTCONF itself."
HOMEPAGE = "https://github.com/AlbrechtL/meta-ethernet-switch-os"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

# A directory, so adding a page needs no change here. BitBake still checksums
# every file in it, so an edit retriggers the build.
SRC_URI = "file://www"
S = "${UNPACKDIR}"

# Plain text files, the same on every machine.
inherit allarch

do_configure[noexec] = "1"
do_compile[noexec] = "1"

# clixon-switch's CLICON_HTTP_DATA_ROOT (HTTP_DATA_ROOT in its Makefile, passed
# by clixon-switch_git.bb) points here. Keep the two in step.
do_install() {
    install -d ${D}${datadir}/ethernet-switch-os/www
    install -m 0644 ${S}/www/* ${D}${datadir}/ethernet-switch-os/www/
}

FILES:${PN} = "${datadir}/ethernet-switch-os/www"

# clixon_restconf serves the page; it is useless without RESTCONF answering.
RDEPENDS:${PN} = "clixon-switch-restconf"
