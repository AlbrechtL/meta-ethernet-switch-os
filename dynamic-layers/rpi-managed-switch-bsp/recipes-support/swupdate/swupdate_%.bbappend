FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# The A/B software set selection replaces the RTL83xx one. It is installed by
# a postfunc so that it lands after, and over, the file the layer-wide
# swupdate_%.bbappend installs in do_install:append, whatever order the two
# .bbappends are applied in.
SRC_URI:append:rpi-managed-switch = " file://20-ethernet-switch-os-mode-ab"

do_install[postfuncs] += "${@'ethernet_switch_os_ab_mode' if 'rpi-managed-switch' in d.getVar('OVERRIDES').split(':') else ''}"
ethernet_switch_os_ab_mode() {
    install -m 0644 ${UNPACKDIR}/20-ethernet-switch-os-mode-ab \
        ${D}${sysconfdir}/swupdate/conf.d/20-ethernet-switch-os-mode
}

# The package now differs per machine.
PACKAGE_ARCH:rpi-managed-switch = "${MACHINE_ARCH}"
