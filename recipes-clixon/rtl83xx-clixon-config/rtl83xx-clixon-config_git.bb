SUMMARY = "clixon configuration for the RTL83xx switch data model"
DESCRIPTION = "clixon.xml, CLI specification, autocli rules and YANG modules \
of the eth-switch model from managed-switch-yang-netconf-cli-docker, plus \
init scripts for the backend and RESTCONF. There is no backend plugin yet, so \
configuration is stored but not applied."
HOMEPAGE = "https://github.com/AlbrechtL/managed-switch-yang-netconf-cli-docker"
# The repository is GPL-3.0; the installed OpenConfig modules are Apache-2.0
# and the IETF/IANA ones BSD-2-Clause (license text in each module header).
LICENSE = "GPL-3.0-only & Apache-2.0 & BSD-2-Clause"
LIC_FILES_CHKSUM = "file://LICENSE;md5=1ebbd3e34237af26da5dc08a4e440464"

SRC_URI = " \
    git://github.com/AlbrechtL/managed-switch-yang-netconf-cli-docker.git;protocol=https;branch=main \
    file://clixon.xml \
    file://clixon-backend \
    file://clixon-restconf \
"
SRCREV = "0b70156ba6232659ab960b63435a45c035011be6"
PV = "0.0+git"

inherit allarch update-rc.d

CLIXON_APP = "eth-switch"
CLIXON_APP_SRC = "${S}/clixon-backend-eth-switch"

# Only the main module and what it imports, transitively (OpenConfig
# interfaces, vlan and spanning-tree plus their types): about 290 KiB instead of
# the 3.2 MiB of YANG in the repository. ietf-yang-types and ietf-inet-types
# come with clixon. Update the list when the main module's imports change;
# clixon searches CLICON_YANG_DIR recursively, so the layout can stay as is.
CLIXON_YANG_FILES = " \
    clixon-eth-switch@2025-09-23.yang \
    misc/iana-if-type@2014-05-08.yang \
    misc/ietf-interfaces@2018-02-20.yang \
    openconfig/interfaces/openconfig-if-aggregate.yang \
    openconfig/interfaces/openconfig-if-ethernet.yang \
    openconfig/interfaces/openconfig-interfaces.yang \
    openconfig/openconfig-extensions.yang \
    openconfig/optical-transport/openconfig-transport-types.yang \
    openconfig/platform/openconfig-platform-types.yang \
    openconfig/stp/openconfig-spanning-tree-types.yang \
    openconfig/stp/openconfig-spanning-tree.yang \
    openconfig/types/openconfig-types.yang \
    openconfig/types/openconfig-yang-types.yang \
    openconfig/vlan/openconfig-vlan-types.yang \
    openconfig/vlan/openconfig-vlan.yang \
"

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${sysconfdir}/clixon/${CLIXON_APP}
    install -m 0644 ${UNPACKDIR}/clixon.xml ${D}${sysconfdir}/clixon.xml
    install -m 0644 ${CLIXON_APP_SRC}/autocli.xml ${D}${sysconfdir}/clixon/${CLIXON_APP}/

    install -d ${D}${libdir}/${CLIXON_APP}/clispec ${D}${libdir}/${CLIXON_APP}/backend
    install -m 0644 ${CLIXON_APP_SRC}/${CLIXON_APP}_cli.cli ${D}${libdir}/${CLIXON_APP}/clispec/

    for f in ${CLIXON_YANG_FILES}; do
        install -D -m 0644 ${CLIXON_APP_SRC}/yang/$f ${D}${datadir}/${CLIXON_APP}/yang/$f
    done

    install -d ${D}${localstatedir}/lib/clixon/${CLIXON_APP}

    install -d ${D}${sysconfdir}/init.d
    install -m 0755 ${UNPACKDIR}/clixon-backend ${D}${sysconfdir}/init.d/
    install -m 0755 ${UNPACKDIR}/clixon-restconf ${D}${sysconfdir}/init.d/
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
    ${libdir}/${CLIXON_APP} \
    ${datadir}/${CLIXON_APP} \
    ${localstatedir}/lib/clixon \
"

RDEPENDS:${PN} = "clixon base-files"
RDEPENDS:${PN}-restconf = "${PN}"

# After rtl83xx-network (05) and dropbear (10); RESTCONF after the backend.
INITSCRIPT_PACKAGES = "${PN} ${PN}-restconf"
INITSCRIPT_NAME:${PN} = "clixon-backend"
INITSCRIPT_PARAMS:${PN} = "defaults 30"
INITSCRIPT_NAME:${PN}-restconf = "clixon-restconf"
INITSCRIPT_PARAMS:${PN}-restconf = "defaults 35"
