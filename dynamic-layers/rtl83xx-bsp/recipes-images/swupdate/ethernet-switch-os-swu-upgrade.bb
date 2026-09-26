SUMMARY = "SWUpdate upgrade for RTL83xx"
DESCRIPTION = "Rewrites the firmware partition and keeps the data partition, \
i.e. the overlay with all changes made on the device. Uploaded to SWUpdate on \
the running flash system."

require ethernet-switch-os-swu.inc

SWUPDATE_IMAGES_FSTYPES[rtl83xx-image] = ".rootfs.rtl83xx-fw"

# The license archive, once per board: this is the .swu every RTL83xx board
# builds. The kernel carries its initramfs, an image of its own.
inherit ethernet-switch-os-licenses
ETHERNET_SWITCH_OS_LICENSE_IMAGES = "rtl83xx-image rtl83xx-image-initramfs"
