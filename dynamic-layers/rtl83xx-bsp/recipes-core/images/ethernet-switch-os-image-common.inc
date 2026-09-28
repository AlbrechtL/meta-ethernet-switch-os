# Userspace shared by the BSP's images: the TFTP initramfs, which is also the
# factory installer, and the flashable squashfs image. Both carry the same
# packages, so a factory install and the system it installs look alike.

IMAGE_INSTALL:append = " packagegroup-ethernet-switch-os-base"

# Pulls in packagegroup-core-ssh-dropbear.
IMAGE_FEATURES += "ssh-server-dropbear"

# Accounts:
#
#   root  empty password, serial console only. dropbear keeps its default -w
#         (no root logins), /etc/securetty lists console devices only, and su
#         is for the wheel group, which nobody is in.
#   cli   the admin account, for SSH, the serial console and the web. No
#         password until the first login sets one (the first-login setup, see
#         ethernet-switch-os-auth); -B lets dropbear accept that first login.
#
# empty-root-password keeps root's empty password, allow-empty-password adds
# -B. Not allow-root-login: that would drop -w.
IMAGE_FEATURES += "empty-root-password allow-empty-password"

# "ssh cli@192.168.1.1" lands directly in the clixon CLI: the login shell is
# ethernet-switch-os-cli, which runs the first-login setup while it is
# pending, prints a joke and execs clixon_cli (ethernet-switch-os-jokes adds
# it to /etc/shells, which dropbear checks). The clicon group grants access to
# the backend socket.
inherit extrausers
EXTRA_USERS_PARAMS = "useradd -m -d /home/cli -s ${bindir}/ethernet-switch-os-cli -G clicon -p '' cli;"

# login(1) lets root in on these terminals only: the serial console (ttyS* on
# the RTL83xx boards and QEMU, ttyAMA0 on the Raspberry Pi), not the pseudo
# terminals of SSH sessions. And su only for the wheel group.
#
# Passwords are hashed with bcrypt (shadow is built with it, see
# recipes-extended/shadow). Cost 8, 2^8 rounds, keeps a check well under a
# second on the RTL838x. Every login pays that once; lighttpd caches a
# checked web login (auth.cache).
ETHERNET_SWITCH_OS_BCRYPT_COST ?= "8"
ROOTFS_POSTPROCESS_COMMAND += "ethernet_switch_os_login_defs;"
ethernet_switch_os_login_defs () {
    printf '%s\n' console ttyS0 ttyS1 ttyAMA0 hvc0 tty1 > ${IMAGE_ROOTFS}${sysconfdir}/securetty
    sed -i \
        -e 's/^SU_WHEEL_ONLY.*/SU_WHEEL_ONLY\tyes/' \
        -e 's/^ENCRYPT_METHOD.*/ENCRYPT_METHOD BCRYPT/' \
        -e '/^#\? *BCRYPT_M..._ROUNDS/d' \
        ${IMAGE_ROOTFS}${sysconfdir}/login.defs
    printf 'BCRYPT_MIN_ROUNDS %s\nBCRYPT_MAX_ROUNDS %s\n' \
        ${ETHERNET_SWITCH_OS_BCRYPT_COST} ${ETHERNET_SWITCH_OS_BCRYPT_COST} \
        >> ${IMAGE_ROOTFS}${sysconfdir}/login.defs
}

# Board specific packages, from conf/distro/include/ethernet-switch-os-boards.inc.
IMAGE_INSTALL:append = " ${ETHERNET_SWITCH_OS_BOARD_PACKAGES}"

# SWUpdate matches the revision field against hardware-compatibility in
# sw-description. Written here rather than by the tune-specific swupdate
# package, because it differs per board.
ROOTFS_POSTPROCESS_COMMAND += "ethernet_switch_os_hwrevision;"
ethernet_switch_os_hwrevision () {
    echo "${ETHERNET_SWITCH_OS_HWREVISION}" > ${IMAGE_ROOTFS}${sysconfdir}/hwrevision
}
