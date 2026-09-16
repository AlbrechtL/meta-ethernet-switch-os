# Userspace shared by the BSP's images: the TFTP initramfs, which is also the
# factory installer, and the flashable squashfs image. Both carry the same
# packages, so a factory install and the system it installs look alike.

IMAGE_INSTALL:append = " packagegroup-ethernet-switch-os-base"

# Pulls in packagegroup-core-ssh-dropbear. The root-login-with-empty-password
# fragment's allow-empty-password makes dropbear accept empty passwords (-B).
IMAGE_FEATURES += "ssh-server-dropbear"

# "ssh cli@192.168.1.1" lands directly in the clixon CLI: clixon_cli is the
# login shell (clixon-switch adds it to /etc/shells, which dropbear
# checks) and the clicon group grants access to the backend socket. The empty
# password is for the proof of concept only.
inherit extrausers
EXTRA_USERS_PARAMS = "useradd -m -d /home/cli -s ${bindir}/clixon_cli -G clicon -p '' cli;"
