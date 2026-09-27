# BUILD_ID: the commit the firmware was built from, on its own next to VERSION.
# Once releases are tagged VERSION is the tag, and this is then the only place
# that names the revision (see
# conf/distro/include/ethernet-switch-os-version.inc).
#
# os-release.bb defines the field but leaves it out of OS_RELEASE_FIELDS, and
# its default is the build time stamp, which says nothing about the sources.
OS_RELEASE_FIELDS:append = " BUILD_ID"
BUILD_ID = "${ETHERNET_SWITCH_OS_GIT_REV}"
