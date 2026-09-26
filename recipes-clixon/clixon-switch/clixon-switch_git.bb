SUMMARY = "clixon backend plugin for the switch configuration"
DESCRIPTION = "Rust clixon backend plugin that applies the OpenConfig switch \
configuration to the kernel: front ports in a VLAN-aware bridge, routed \
VLAN interfaces with static IPv4 addresses or a DHCP client (busybox udhcpc), \
spanning tree (STP, RSTP, MSTP) with mstpd, and a read-only SNMPv3 agent \
(snmpd with clixon_snmp for BRIDGE-MIB, Q-BRIDGE-MIB and RSTP-MIB). \
Also installs the YANG modules, clixon.xml, the CLI specification, the \
factory default, the udhcpc script and init scripts for the backend and \
RESTCONF. The status web page clixon_restconf serves is a separate recipe, \
ethernet-switch-os-webui."
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
# Always build the current head of the master branch.
SRCREV = "${AUTOREV}"
PV = "0.1.0+git"

inherit cargo update-rc.d deploy

# There is no crate list to keep in step with upstream's Cargo.lock: cargo
# downloads the crates itself in do_compile, which therefore needs network
# access. --frozen would forbid that; --locked still insists on Cargo.lock.
CARGO_DISABLE_BITBAKE_VENDORING = "1"
CARGO_BUILD_FLAGS:remove = "--frozen"
CARGO_BUILD_FLAGS:append = " --locked"
do_compile[network] = "1"

DEPENDS += "clixon"

# Only the plugin; the other workspace members are the libraries it uses.
CARGO_BUILD_FLAGS += "-p clixon-switch-plugin"

# The crates are linked into the plugin, but with cargo fetching them BitBake
# knows nothing of them: no license texts, no SBOM entries. Collect their
# licenses while the registry cache is there, for ethernet-switch-os-licenses.
do_compile:append() {
    "${CARGO}" metadata --format-version 1 --locked --offline \
        --manifest-path=${CARGO_MANIFEST_PATH} --filter-platform ${RUST_HOST_SYS} \
        > ${B}/cargo-metadata.json
}
do_compile[postfuncs] += "clixon_switch_crate_licenses"

# Every crate the plugin links, i.e. reachable along normal dependencies:
# build and dev dependencies and proc macros only run on the build host.
# Workspace members (no source) are this repository, under its LICENSE.
python clixon_switch_crate_licenses() {
    import json, shutil

    meta = json.load(open(d.expand("${B}/cargo-metadata.json")))
    pkgs = {p["id"]: p for p in meta["packages"]}
    nodes = {n["id"]: n for n in meta["resolve"]["nodes"]}
    root = next(p["id"] for p in meta["packages"] if p["name"] == "clixon-switch-plugin")

    seen, todo = set(), [root]
    while todo:
        i = todo.pop()
        if i in seen:
            continue
        seen.add(i)
        for dep in nodes[i]["deps"]:
            if not any(k["kind"] is None for k in dep["dep_kinds"]):
                continue
            if any("proc-macro" in t["kind"] for t in pkgs[dep["pkg"]]["targets"]):
                continue
            todo.append(dep["pkg"])

    out = d.expand("${B}/crate-licenses")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    manifest = []
    for p in sorted((pkgs[i] for i in seen if pkgs[i]["source"]),
                    key=lambda p: (p["name"], p["version"])):
        src = os.path.dirname(p["manifest_path"])
        files = [f for f in os.listdir(src) if f.upper().startswith(
            ("LICENSE", "LICENCE", "COPYING", "COPYRIGHT", "NOTICE", "UNLICENSE"))]
        if p.get("license_file"):
            files.append(p["license_file"])
        if not files:
            bb.warn("crate %s %s ships no license file" % (p["name"], p["version"]))
        dst = os.path.join(out, "%s-%s" % (p["name"], p["version"]))
        os.makedirs(dst)
        for f in sorted(set(files)):
            if os.path.isfile(os.path.join(src, f)):
                shutil.copy(os.path.join(src, f), os.path.join(dst, os.path.basename(f)))
        manifest.append("CRATE NAME: %s\nCRATE VERSION: %s\nLICENSE: %s\nSOURCE: %s\n"
                        % (p["name"], p["version"], p["license"] or "unknown", p["source"]))
    with open(os.path.join(out, "crates.manifest"), "w") as f:
        f.write("\n".join(manifest))
}

# Factory default: front ports as labelled by SWITCH_PORT() in the device
# tree, and the management address on vlan1. The port list is per board, see
# conf/distro/include/ethernet-switch-os-boards.inc, and with it the package.
ETHERNET_SWITCH_OS_LAN_PORTS ?= "lan1 lan2 lan3 lan4 lan5 lan6 lan7 lan8"
PACKAGE_ARCH = "${MACHINE_ARCH}"
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
        HTTP_DATA_ROOT=${datadir}/ethernet-switch-os/www \
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

    # Not for the image: the MIBs are published with the firmware only.
    rm -rf ${B}/mib-install
    oe_runmake -C ${S} install-mibs DESTDIR=${B}/mib-install DATADIR=/
}

# Published with the firmware (kas/board/*.yml "artifacts:"): the YANG
# modules clixon loads, this repository's and clixon's own (both
# CLICON_YANG_DIR), and the MIBs the SNMP agent serves. The crate licenses
# are picked up by ethernet-switch-os-licenses.bbclass.
ETHERNET_SWITCH_OS_TAR = "tar --sort=name --owner=0 --group=0 --numeric-owner \
    --mtime=@${SOURCE_DATE_EPOCH} --format=gnu"

do_deploy() {
    rm -rf ${B}/deploy-yang
    install -d ${B}/deploy-yang/yang/clixon
    cp -r ${D}${datadir}/clixon-switch/yang ${B}/deploy-yang/yang/clixon-switch
    find ${RECIPE_SYSROOT}${datadir}/clixon -name '*.yang' \
        -exec install -m 0644 {} ${B}/deploy-yang/yang/clixon/ \;
    ${ETHERNET_SWITCH_OS_TAR} -C ${B}/deploy-yang -cf - yang | gzip -9n \
        > ${DEPLOYDIR}/ethernet-switch-os-yang-${MACHINE}.tar.gz

    ${ETHERNET_SWITCH_OS_TAR} -C ${B}/mib-install/clixon-switch -cf - mib | gzip -9n \
        > ${DEPLOYDIR}/ethernet-switch-os-mibs-${MACHINE}.tar.gz

    ${ETHERNET_SWITCH_OS_TAR} -C ${B} -cf - crate-licenses | gzip -9n \
        > ${DEPLOYDIR}/clixon-switch-crate-licenses-${MACHINE}.tar.gz
}
addtask deploy after do_install before do_build

# dropbear rejects logins whose shell is not in /etc/shells, and the "cli" user
# (see the image bbappend) has clixon_cli as its shell.
pkg_postinst:${PN}() {
    grep -qx '${bindir}/clixon_cli' $D${sysconfdir}/shells || \
        echo '${bindir}/clixon_cli' >> $D${sysconfdir}/shells
}

PACKAGES =+ "${PN}-restconf"

FILES:${PN}-restconf = "${sysconfdir}/init.d/clixon-restconf"

# ${datadir}/ethernet-switch-os/www is the http-data root, which the Makefile
# creates empty because clixon_restconf resolves it before every request and
# fails when it is missing. ethernet-switch-os-webui fills it; sharing a
# directory between packages is fine, only duplicate files are a conflict.
FILES:${PN} += " \
    ${base_sbindir}/bridge-stp \
    ${datadir}/ethernet-switch-os/www \
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
# os-release: the plugin reads /etc/os-release for the firmware version in
# /system/state.
RDEPENDS:${PN} = "clixon base-files ${VIRTUAL-RUNTIME_base-utils} mstpd-mstpd \
    clixon-snmp net-snmp-server-snmpd os-release"
RDEPENDS:${PN}-restconf = "${PN}"

# The backend configures the network, so it takes the old network script's
# slot: before dropbear (10). RESTCONF after the backend.
INITSCRIPT_PACKAGES = "${PN} ${PN}-restconf"
INITSCRIPT_NAME:${PN} = "clixon-backend"
INITSCRIPT_PARAMS:${PN} = "defaults 05"
INITSCRIPT_NAME:${PN}-restconf = "clixon-restconf"
INITSCRIPT_PARAMS:${PN}-restconf = "defaults 35"
