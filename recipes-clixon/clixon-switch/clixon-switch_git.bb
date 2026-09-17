SUMMARY = "clixon backend plugin for the switch configuration"
DESCRIPTION = "Rust clixon backend plugin that applies the OpenConfig switch \
configuration to the kernel: front ports in a VLAN-aware bridge, routed \
VLAN interfaces with static IPv4 addresses or a DHCP client (busybox udhcpc), \
spanning tree (STP, RSTP, MSTP) with mstpd, and a read-only SNMPv3 agent \
(snmpd with clixon_snmp for BRIDGE-MIB, Q-BRIDGE-MIB and RSTP-MIB). \
Also installs the YANG modules, clixon.xml, the CLI specification, the factory \
default, the udhcpc script, init scripts for the backend and RESTCONF, and \
a read-only status web page that clixon_restconf serves on its own port."
HOMEPAGE = "https://github.com/AlbrechtL/clixon-switch-rs"
# The repository and the OpenConfig modules are Apache-2.0, the IETF/IANA
# modules BSD-2-Clause (license text in each module header). The MIB
# translations in yang/mib derive from the IETF MIBs.
LICENSE = "Apache-2.0 & BSD-2-Clause"
LIC_FILES_CHKSUM = "file://LICENSE;md5=89aea4e17d99a7cacdbeed46a0096b10"

SRC_URI = " \
    git://github.com/AlbrechtL/clixon-switch-rs.git;protocol=https;branch=master \
    file://clixon-backend \
    file://clixon-restconf \
"
# Update together with the crate list: bitbake -c update_crates clixon-switch
SRCREV = "6ab90e9986d15661e5d4ae007bf5c3d69600586b"
PV = "0.1.0+git"

require ${BPN}-crates.inc

inherit cargo cargo-update-recipe-crates update-rc.d

DEPENDS += "clixon"

# Only the plugin; the other workspace members are the libraries it uses.
CARGO_BUILD_FLAGS += "-p clixon-switch-plugin"

# Factory default: front ports as labelled by SWITCH_PORT() in the device
# tree, and the management address on vlan1.
ETHERNET_SWITCH_OS_LAN_PORTS ?= "lan1 lan2 lan3 lan4 lan5 lan6 lan7 lan8"
ETHERNET_SWITCH_OS_LAN_ADDRESS ?= "192.168.1.1/24"

do_install() {
    # The Makefile writes generated files to BUILDDIR only, so S stays
    # untouched (it is the developer's checkout with devtool).
    oe_runmake -C ${S} install \
        DESTDIR=${D} \
        PREFIX=${prefix} \
        SYSCONFDIR=${sysconfdir} \
        LIBDIR=${libdir} \
        DATADIR=${datadir} \
        LOCALSTATEDIR=${localstatedir} \
        RESTCONF_PORT=80 \
        LAN_PORTS="${ETHERNET_SWITCH_OS_LAN_PORTS}" \
        LAN_ADDRESS="${ETHERNET_SWITCH_OS_LAN_ADDRESS}" \
        BUILDDIR=${B}/make \
        PLUGIN=${B}/target/${CARGO_TARGET_SUBDIR}/libclixon_switch_plugin.so

    install -d ${D}${sysconfdir}/init.d
    install -m 0755 ${UNPACKDIR}/clixon-backend ${D}${sysconfdir}/init.d/
    install -m 0755 ${UNPACKDIR}/clixon-restconf ${D}${sysconfdir}/init.d/

    # The kernel runs /sbin/bridge-stp when spanning tree is switched on; it
    # leaves spanning tree to mstpd, which the plugin runs.
    install -d ${D}${base_sbindir}
    ln -sf ${libdir}/clixon-switch/bridge-stp ${D}${base_sbindir}/bridge-stp

    # snmpd counts its boots here, on flash (the plugin's default).
    install -d -m 0700 ${D}${localstatedir}/lib/net-snmp

    # The DHCP client's script rewrites resolv.conf on every lease renewal.
    # It follows this symlink, so that happens on tmpfs, not on flash.
    ln -sf ${localstatedir}/run/resolv.conf ${D}${sysconfdir}/resolv.conf
}

# dropbear rejects logins whose shell is not in /etc/shells, and the "cli" user
# (see the image bbappend) has clixon_cli as its shell.
pkg_postinst:${PN}() {
    grep -qx '${bindir}/clixon_cli' $D${sysconfdir}/shells || \
        echo '${bindir}/clixon_cli' >> $D${sysconfdir}/shells
}

PACKAGES =+ "${PN}-restconf ${PN}-www"

FILES:${PN}-restconf = "${sysconfdir}/init.d/clixon-restconf"
# The status page at http://<switch>/, served by clixon_restconf (http-data in
# clixon.xml). It reads the firmware version from os-release.
FILES:${PN}-www = "${datadir}/clixon-switch/www"

FILES:${PN} += " \
    ${base_sbindir}/bridge-stp \
    ${sysconfdir}/resolv.conf \
    ${libdir}/clixon-switch \
    ${datadir}/clixon-switch \
    ${localstatedir}/lib/clixon \
    ${localstatedir}/lib/net-snmp \
"

# base-utils (busybox) also provides udhcpc and ip for the DHCP client.
# mstpd-mstpd: mstpd and mstpctl, patched in recipes-networking/mstpd.
# clixon-snmp and net-snmp-server-snmpd: the SNMP agent, both started by the
# plugin; trimmed in recipes-networking/net-snmp, patched in recipes-clixon.
RDEPENDS:${PN} = "clixon base-files ${VIRTUAL-RUNTIME_base-utils} mstpd-mstpd \
    clixon-snmp net-snmp-server-snmpd"
RDEPENDS:${PN}-restconf = "${PN}"
RDEPENDS:${PN}-www = "${PN}-restconf os-release"

# The backend configures the network, so it takes the old network script's
# slot: before dropbear (10). RESTCONF after the backend.
INITSCRIPT_PACKAGES = "${PN} ${PN}-restconf"
INITSCRIPT_NAME:${PN} = "clixon-backend"
INITSCRIPT_PARAMS:${PN} = "defaults 05"
INITSCRIPT_NAME:${PN}-restconf = "clixon-restconf"
INITSCRIPT_PARAMS:${PN}-restconf = "defaults 35"
