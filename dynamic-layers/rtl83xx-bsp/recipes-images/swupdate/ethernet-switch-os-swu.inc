# Common part of the .swu recipes. The images come from rtl83xx-image
# (meta-rtl83xx-bsp, image_types_rtl83xx.bbclass); each recipe ships its own
# sw-description with one software set, ethernet-switch-os.factory or
# ethernet-switch-os.upgrade, which
# /etc/swupdate/conf.d/20-ethernet-switch-os-mode selects on the target.

LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

COMPATIBLE_MACHINE = "^rtl83xx$"

inherit swupdate

SRC_URI = "file://sw-description"

IMAGE_DEPENDS = "rtl83xx-image"
SWUPDATE_IMAGES = "rtl83xx-image"
SWUPDATE_IMAGES_NOAPPEND_MACHINE[rtl83xx-image] = "0"

# The .swu is named after IMAGE_NAME; ".rootfs" makes no sense for it.
IMAGE_NAME_SUFFIX = ""
