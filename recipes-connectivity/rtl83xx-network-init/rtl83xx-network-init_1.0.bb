SUMMARY = "Static network setup for RTL83xx switches"
DESCRIPTION = "Bridges all front ports into br-lan with a static address. \
A placeholder until the clixon backend plugin configures the interfaces."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = "file://rtl83xx-network"

S = "${UNPACKDIR}"

inherit allarch update-rc.d

# Front ports as labelled by SWITCH_PORT() in the device tree.
RTL_LAN_PORTS ?= "lan1 lan2 lan3 lan4 lan5 lan6 lan7 lan8"
RTL_LAN_ADDRESS ?= "192.168.1.1/24"

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${sysconfdir}/init.d
    sed -e "s|@LAN_PORTS@|${RTL_LAN_PORTS}|" \
        -e "s|@LAN_ADDRESS@|${RTL_LAN_ADDRESS}|" \
        ${S}/rtl83xx-network > ${D}${sysconfdir}/init.d/rtl83xx-network
    chmod 0755 ${D}${sysconfdir}/init.d/rtl83xx-network
}

# Only busybox "ip" is needed (CONFIG_IP, CONFIG_FEATURE_IP_LINK: "type bridge"
# and "master" are both supported). Start before dropbear (10) and the clixon
# backend.
INITSCRIPT_NAME = "rtl83xx-network"
INITSCRIPT_PARAMS = "defaults 05"
