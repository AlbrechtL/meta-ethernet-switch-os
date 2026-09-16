SUMMARY = "clixon backend plugin for the switch configuration"
DESCRIPTION = "Rust clixon backend plugin that applies the OpenConfig switch \
configuration to the kernel: front ports in a VLAN-aware bridge, and routed \
VLAN interfaces with static IPv4 addresses or a DHCP client (busybox udhcpc). \
Also installs the YANG modules, clixon.xml, the CLI specification, the factory \
default, the udhcpc script and init scripts for the backend and RESTCONF."
HOMEPAGE = "https://github.com/AlbrechtL/clixon-switch-rs"
# The repository and the OpenConfig modules are Apache-2.0, the IETF/IANA
# modules BSD-2-Clause (license text in each module header).
LICENSE = "Apache-2.0 & BSD-2-Clause"
LIC_FILES_CHKSUM = "file://LICENSE;md5=89aea4e17d99a7cacdbeed46a0096b10"

SRC_URI = " \
    git://github.com/AlbrechtL/clixon-switch-rs.git;protocol=https;branch=master \
    file://clixon-backend \
    file://clixon-restconf \
"
# Update together with the crate list: bitbake -c update_crates clixon-switch
SRCREV = "568f91ac135c5820b7946351e33ce0793a0509f1"
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

PACKAGES =+ "${PN}-restconf"

FILES:${PN}-restconf = "${sysconfdir}/init.d/clixon-restconf"

FILES:${PN} += " \
    ${sysconfdir}/resolv.conf \
    ${libdir}/clixon-switch \
    ${datadir}/clixon-switch \
    ${localstatedir}/lib/clixon \
"

# base-utils (busybox) also provides udhcpc and ip for the DHCP client.
RDEPENDS:${PN} = "clixon base-files ${VIRTUAL-RUNTIME_base-utils}"
RDEPENDS:${PN}-restconf = "${PN}"

# The backend configures the network, so it takes the old network script's
# slot: before dropbear (10). RESTCONF after the backend.
INITSCRIPT_PACKAGES = "${PN} ${PN}-restconf"
INITSCRIPT_NAME:${PN} = "clixon-backend"
INITSCRIPT_PARAMS:${PN} = "defaults 05"
INITSCRIPT_NAME:${PN}-restconf = "clixon-restconf"
INITSCRIPT_PARAMS:${PN}-restconf = "defaults 35"
