# Userspace shared by the BSP's images: the TFTP initramfs, which is also the
# factory installer, and the flashable squashfs image. Both carry the same
# packages, so a factory install and the system it installs look alike.

IMAGE_INSTALL:append = " packagegroup-ethernet-switch-os-base"

# Pulls in packagegroup-core-ssh-dropbear. The root-login-with-empty-password
# fragment's allow-empty-password makes dropbear accept empty passwords (-B).
IMAGE_FEATURES += "ssh-server-dropbear"

# "ssh cli@192.168.1.1" lands directly in the clixon CLI: the login shell is
# ethernet-switch-os-cli, which prints a joke and execs clixon_cli
# (ethernet-switch-os-jokes adds it to /etc/shells, which dropbear checks) and
# the clicon group grants access to the backend socket. The empty password is
# for the proof of concept only.
inherit extrausers
EXTRA_USERS_PARAMS = "useradd -m -d /home/cli -s ${bindir}/ethernet-switch-os-cli -G clicon -p '' cli;"

# Board specific packages, from conf/distro/include/ethernet-switch-os-boards.inc.
IMAGE_INSTALL:append = " ${ETHERNET_SWITCH_OS_BOARD_PACKAGES}"

# SWUpdate matches the revision field against hardware-compatibility in
# sw-description. Written here rather than by the tune-specific swupdate
# package, because it differs per board.
ROOTFS_POSTPROCESS_COMMAND += "ethernet_switch_os_hwrevision;"
ethernet_switch_os_hwrevision () {
    echo "${ETHERNET_SWITCH_OS_HWREVISION}" > ${IMAGE_ROOTFS}${sysconfdir}/hwrevision
}
