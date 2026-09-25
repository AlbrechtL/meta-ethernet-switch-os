# Userspace on top of the BSP's A/B SD card image, the same as on the RTL83xx
# images. The include is shared with them, found through BBPATH.

require dynamic-layers/rtl83xx-bsp/recipes-core/images/ethernet-switch-os-image-common.inc

# clixon creates its user and the clicon group (useradd.bbclass), so it depends on
# shadow, and shadow on shadow-base. poky-tiny excludes shadow-base because
# logins fail with a kernel built without CONFIG_MULTIUSER; the Raspberry Pi
# kernel has it. (rtl83xx-image assigns PACKAGE_EXCLUDE with "=", which drops
# poky-tiny's entry there as well.)
PACKAGE_EXCLUDE:remove = "shadow-base"
