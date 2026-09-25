SUMMARY = "Random Ethernet switch joke at login"
DESCRIPTION = "Prints a random two-line joke when root or the cli user logs in \
on the serial console or over SSH. The cli user's login shell is clixon_cli, \
which does not read /etc/profile.d, so it gets a small wrapper as its shell."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = " \
    file://switch-jokes.txt \
    file://ethernet-switch-os-joke \
    file://ethernet-switch-os-joke.sh \
    file://ethernet-switch-os-cli \
"

S = "${UNPACKDIR}"

inherit allarch

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${datadir}/ethernet-switch-os ${D}${bindir} ${D}${sysconfdir}/profile.d
    install -m 0644 ${S}/switch-jokes.txt ${D}${datadir}/ethernet-switch-os/jokes.txt
    install -m 0755 ${S}/ethernet-switch-os-joke ${D}${bindir}/
    install -m 0755 ${S}/ethernet-switch-os-cli ${D}${bindir}/
    install -m 0644 ${S}/ethernet-switch-os-joke.sh ${D}${sysconfdir}/profile.d/
}

# The default FILES only take ${datadir}/${BPN}. Sharing the directory with the
# other ethernet-switch-os packages is fine, only duplicate files are a conflict.
FILES:${PN} += "${datadir}/ethernet-switch-os"

# dropbear rejects logins whose shell is not in /etc/shells. The cli user (see
# the image bbappend) has ethernet-switch-os-cli as its shell.
pkg_postinst:${PN}() {
    grep -qx '${bindir}/ethernet-switch-os-cli' $D${sysconfdir}/shells || \
        echo '${bindir}/ethernet-switch-os-cli' >> $D${sysconfdir}/shells
}

# busybox: awk and date. clixon: the wrapper starts clixon_cli.
RDEPENDS:${PN} = "busybox clixon"
