SUMMARY = "Base userspace for Ethernet switches"
DESCRIPTION = "The clixon YANG management framework with the clixon-switch \
backend plugin, which configures the network, its CLI, RESTCONF and status \
web page, and the SWUpdate daemon with its web interface."

# packagegroup.bbclass defaults to allarch, and an allarch packagegroup must not
# RDEPEND on names the debian class renames per architecture (a package holding
# only a shared library becomes "lib<name><soversion>"). This has to come
# BEFORE the inherit: the class decides with
# PACKAGE_ARCH_EXPANDED := "${PACKAGE_ARCH}". Set afterwards it is silently too
# late, and the rename check is a non-fatal bb.error, so the task still
# "succeeds" and is not re-run.
PACKAGE_ARCH = "${TUNE_PKGARCH}"

inherit packagegroup

RDEPENDS:${PN} = " \
    clixon \
    clixon-switch \
    clixon-switch-restconf \
    ethernet-switch-os-webui \
    swupdate \
    swupdate-www \
"
