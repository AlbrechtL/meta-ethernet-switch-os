SUMMARY = "SWUpdate upgrade for RTL83xx"
DESCRIPTION = "Rewrites the firmware partition and keeps the data partition, \
i.e. the overlay with all changes made on the device. Uploaded to SWUpdate on \
the running flash system."

require ethernet-switch-os-swu.inc

SWUPDATE_IMAGES_FSTYPES[rtl83xx-image] = ".rootfs.rtl83xx-fw"
