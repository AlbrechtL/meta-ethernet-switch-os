FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# rtl83xx.cfg is merged over meta-swupdate's defconfig by swupdate.inc
# (find_cfgs + merge_config.sh), and the anonymous python there derives
# DEPENDS from the merged result.
SRC_URI += " \
    file://rtl83xx.cfg \
    file://09-rtl83xx-web \
    file://hwrevision \
"

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

    # Matched against hardware-compatibility in sw-description.
    install -m 0644 ${UNPACKDIR}/hwrevision ${D}${sysconfdir}/hwrevision
}

FILES:${PN} += "${sysconfdir}/hwrevision"
FILES:${PN}-www += "${sysconfdir}/swupdate/conf.d/09-rtl83xx-web"

# /etc/init.d/swupdate sources /etc/init.d/functions (pidofproc) and exits if
# it is missing. poky-tiny does not install initscripts.
RDEPENDS:${PN} += "initd-functions"
