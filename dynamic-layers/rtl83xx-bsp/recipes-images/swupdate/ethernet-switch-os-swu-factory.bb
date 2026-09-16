SUMMARY = "SWUpdate factory install for RTL83xx"
DESCRIPTION = "Writes the firmware partition and wipes the data partition. \
Uploaded to SWUpdate in the TFTP initramfs."

require ethernet-switch-os-swu.inc

SWUPDATE_IMAGES_FSTYPES[rtl83xx-image] = ".rootfs.rtl83xx-fw .rootfs.rtl83xx-data"
