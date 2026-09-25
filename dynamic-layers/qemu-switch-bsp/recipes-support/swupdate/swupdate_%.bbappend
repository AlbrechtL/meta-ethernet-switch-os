FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# EFI Boot Guard instead of U-Boot as bootloader interface, merged over
# ethernet-switch-os.cfg (later fragments win), and the A/B software set
# selection. The mode script is installed by a postfunc so that it lands
# after, and over, the file the layer-wide swupdate_%.bbappend installs in
# do_install:append, whatever order the two .bbappends are applied in.
SRC_URI:append:qemu-switch = " \
    file://ethernet-switch-os-ebg.cfg \
    file://20-ethernet-switch-os-mode-ab \
"

# See the layer-wide swupdate_%.bbappend: swupdate.inc derives DEPENDS (here
# efibootguard instead of libubootenv) from the fragments at parse time,
# which the parse cache does not know about.
python () {
    if 'qemu-switch' in d.getVar('OVERRIDES').split(':'):
        cfg = bb.fetch2.localpath('file://ethernet-switch-os-ebg.cfg', d)
        if cfg and os.path.exists(cfg):
            bb.parse.mark_dependency(d, cfg)
}

do_install[postfuncs] += "${@'ethernet_switch_os_ab_mode' if 'qemu-switch' in d.getVar('OVERRIDES').split(':') else ''}"
ethernet_switch_os_ab_mode() {
    install -m 0644 ${UNPACKDIR}/20-ethernet-switch-os-mode-ab \
        ${D}${sysconfdir}/swupdate/conf.d/20-ethernet-switch-os-mode
}

# The package now differs per machine.
PACKAGE_ARCH:qemu-switch = "${MACHINE_ARCH}"
