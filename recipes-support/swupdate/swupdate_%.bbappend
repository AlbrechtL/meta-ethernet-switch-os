FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# rtl83xx.cfg is merged over meta-swupdate's defconfig by swupdate.inc
# (find_cfgs + merge_config.sh), and the anonymous python there derives
# DEPENDS from the merged result.
SRC_URI += " \
    file://rtl83xx.cfg \
    file://09-rtl83xx-web \
    file://20-rtl83xx-mode \
    file://hwrevision \
"

# swupdate.inc derives DEPENDS (openssl, libubootenv, mtd-utils, ...) from
# defconfig plus rtl83xx.cfg in anonymous python, at parse time. BitBake's
# parse cache does not know the recipe reads those files, so after an edit to
# rtl83xx.cfg the recipe kept its stale DEPENDS. Switching to
# CONFIG_SSL_IMPL_OPENSSL then failed with "openssl/bio.h: No such file", next
# to "basehash value changed ... metadata is not deterministic". Declare the
# fragment as a parse dependency.
python () {
    cfg = bb.fetch2.localpath('file://rtl83xx.cfg', d)
    if cfg and os.path.exists(cfg):
        bb.parse.mark_dependency(d, cfg)
}

# swupdate.inc unsets LDFLAGS in do_compile only, but "make install" relinks
# the kbuild built-in.o objects. With poky-tiny's gcsections.inc those partial
# (-r) links get -Wl,--gc-sections and ld refuses: "--gc-sections requires a
# defined symbol root". The final link still gets the flags through
# CONFIG_EXTRA_LDFLAGS.
do_install:prepend() {
    unset LDFLAGS
}

do_install:append() {
    # Sourced by swupdate.sh before 10-mongoose-args, which expands
    # SWUPDATE_MONGOOSE_EXTRA_ARGS.
    install -d ${D}${sysconfdir}/swupdate/conf.d
    install -m 0644 ${UNPACKDIR}/09-rtl83xx-web ${D}${sysconfdir}/swupdate/conf.d/

    # Software set selection, and SWUpdate from RAM on the flash system.
    install -m 0644 ${UNPACKDIR}/20-rtl83xx-mode ${D}${sysconfdir}/swupdate/conf.d/

    # Matched against hardware-compatibility in sw-description.
    install -m 0644 ${UNPACKDIR}/hwrevision ${D}${sysconfdir}/hwrevision
}

FILES:${PN} += " \
    ${sysconfdir}/hwrevision \
    ${sysconfdir}/swupdate/conf.d/20-rtl83xx-mode \
"
FILES:${PN}-www += "${sysconfdir}/swupdate/conf.d/09-rtl83xx-web"

# /etc/init.d/swupdate sources /etc/init.d/functions (pidofproc) and exits if
# it is missing. poky-tiny does not install initscripts.
RDEPENDS:${PN} += "initd-functions"
