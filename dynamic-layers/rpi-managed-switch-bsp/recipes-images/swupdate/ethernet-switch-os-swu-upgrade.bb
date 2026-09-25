SUMMARY = "SWUpdate A/B upgrade for the Raspberry Pi 4-port managed switch"
DESCRIPTION = "Writes the root filesystem and kernel of the slot that is not \
running and makes U-Boot try it on the next boot. The data partition, i.e. \
the overlay with all changes made on the device, is kept."

LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

COMPATIBLE_MACHINE = "^rpi-managed-switch$"

inherit swupdate

# Two software sets, ethernet-switch-os.slot-a and ethernet-switch-os.slot-b,
# named after the slot they write. /etc/swupdate/conf.d/20-ethernet-switch-os-mode
# picks the one that is not running.
SRC_URI = "file://sw-description"

IMAGE_DEPENDS = "rpi-switch-image virtual/kernel"

# The squashfs of rpi-switch-image, and the kernel as deployed by
# linux-raspberrypi: a zImage, KERNEL_IMAGETYPE_UBOOT in
# meta-rpi-managed-switch-bsp's rpi-managed-switch.inc.
SWUPDATE_IMAGES = "rpi-switch-image zImage"
SWUPDATE_IMAGES_FSTYPES[rpi-switch-image] = ".rootfs.squashfs-xz"
SWUPDATE_IMAGES_NOAPPEND_MACHINE[rpi-switch-image] = "0"
SWUPDATE_IMAGES_FSTYPES[zImage] = ".bin"
SWUPDATE_IMAGES_NOAPPEND_MACHINE[zImage] = "0"

# The .swu is named after IMAGE_NAME; ".rootfs" makes no sense for it.
IMAGE_NAME_SUFFIX = ""
