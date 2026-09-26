SUMMARY = "SWUpdate A/B upgrade for the emulated QEMU switch"
DESCRIPTION = "Writes the root filesystem of the slot that is not running and \
the kernel on its config partition, and makes EFI Boot Guard try it on the \
next boot. The data partition, i.e. the overlay with all changes made on the \
device, is kept."

LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

COMPATIBLE_MACHINE = "^qemu-switch$"

inherit swupdate ethernet-switch-os-licenses

# Two software sets, ethernet-switch-os.slot-a and ethernet-switch-os.slot-b,
# named after the slot they write. /etc/swupdate/conf.d/20-ethernet-switch-os-mode
# picks the one that is not running.
SRC_URI = "file://sw-description"

IMAGE_DEPENDS = "qemu-switch-image virtual/kernel"

# The squashfs of qemu-switch-image, and the kernel as deployed by
# linux-yocto-tiny.
SWUPDATE_IMAGES = "qemu-switch-image bzImage"
SWUPDATE_IMAGES_FSTYPES[qemu-switch-image] = ".rootfs.squashfs-xz"
SWUPDATE_IMAGES_NOAPPEND_MACHINE[qemu-switch-image] = "0"
SWUPDATE_IMAGES_FSTYPES[bzImage] = ".bin"
SWUPDATE_IMAGES_NOAPPEND_MACHINE[bzImage] = "0"

# The .swu is named after IMAGE_NAME; ".rootfs" makes no sense for it.
IMAGE_NAME_SUFFIX = ""
