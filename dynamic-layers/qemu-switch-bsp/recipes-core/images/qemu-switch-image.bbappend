# Userspace on top of the BSP's A/B disk image, the same as on the other
# boards. The include is shared with them, found through BBPATH.

require dynamic-layers/rtl83xx-bsp/recipes-core/images/ethernet-switch-os-image-common.inc

# The front ports are virtio-net devices, not DSA ports, so the plugin cannot
# find them by itself. /etc/init.d/clixon-backend exports this to it.
ROOTFS_POSTPROCESS_COMMAND += "ethernet_switch_os_qemu_ports;"
ethernet_switch_os_qemu_ports () {
    install -d ${IMAGE_ROOTFS}${sysconfdir}/default
    echo 'CLIXON_SWITCH_PORTS="${ETHERNET_SWITCH_OS_LAN_PORTS}"' > ${IMAGE_ROOTFS}${sysconfdir}/default/clixon-backend
}

# clixon creates its user and the clicon group (useradd.bbclass), so it depends on
# shadow, and shadow on shadow-base. poky-tiny excludes shadow-base because
# logins fail with a kernel built without CONFIG_MULTIUSER; the QEMU switch's
# kernel has it (qemu-switch-yocto.cfg).
PACKAGE_EXCLUDE:remove = "shadow-base"
