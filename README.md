# meta-rtl83xx-distro

> **⚠️ Proof of concept.** This project is a proof of concept, created with
> the help of AI. It has not undergone thorough review or hardening, and
> should not be assumed suitable for production use.

Userspace policy for RTL83xx switches, on top of `meta-rtl83xx-bsp`:

- [clixon](https://www.clicon.org/) with the
  [clixon-switch](https://github.com/AlbrechtL/clixon-switch-rs) backend
  plugin (Rust), which configures the network from an OpenConfig
  configuration. Factory default: `lan1`..`lan8` as access ports in VLAN 1 of
  the VLAN-aware bridge `br-lan`, and **192.168.1.1/24** on `vlan1`.
  `ssh cli@192.168.1.1` opens the clixon CLI directly, and RESTCONF answers on
  **http://192.168.1.1/restconf** (plain HTTP/1, no authentication). A commit
  applies a change; only `save` (or a copy-config to startup) makes it survive
  a reboot.
- dropbear SSH (`ssh root@192.168.1.1` for a shell). Both `root` and `cli`
  have an empty password via the `core/yocto/root-login-with-empty-password`
  fragment -- proof of concept only.
- SWUpdate daemon with its web UI on **http://192.168.1.1:8080**, plus two
  .swu images for the BSP's flash layout: `rtl83xx-swu-factory` (first
  install from the TFTP initramfs) and `rtl83xx-swu-upgrade` (update in
  place, user data kept). See "Flash image" in `meta-rtl83xx-bsp`'s README.

No NetworkManager, D-Bus, udev or systemd: busybox is init and mdev.

The BSP stays hardware-only and boots without this layer.

See [TECHNICAL.md](TECHNICAL.md) for the clixon layout on the target and
known traps/pitfalls.

## Layers

| Layer | Branch | Pinned at |
|---|---|---|
| meta-openembedded (`meta-oe`) | wrynose | `14282a02be9c74a1276a7cda7d6c89e054699a11` |
| meta-swupdate (`https://github.com/sbabic/meta-swupdate`) | wrynose | `c0658455606b3a37d85d7cf03703d8b8d2ead667` |

```sh
cd layers
git clone -b wrynose https://git.openembedded.org/meta-openembedded
git clone -b wrynose https://github.com/sbabic/meta-swupdate
cd ../build && . init-build-env
bitbake-layers add-layer ../layers/meta-openembedded/meta-oe \
    ../layers/meta-swupdate ../layers/meta-rtl83xx-distro
bitbake-config-build disable-fragment distro/poky-tiny
bitbake-config-build enable-fragment distro/rtl83xx-tiny
```

`meta-python` and `meta-networking` are no longer required (they were for
NetworkManager); leaving them in `bblayers.conf` is harmless.

These layers (and `meta-rtl83xx-bsp`) are added by hand, not through
`config/config-upstream.json`, so a `bitbake-setup update` that regenerates
`bblayers.conf` drops them again.

## Contents

| File | Role |
|---|---|
| `conf/distro/rtl83xx-tiny.conf` | poky-tiny + the `sysvinit` script machinery |
| `recipes-core/packagegroups/packagegroup-rtl83xx-base.bb` | clixon with the clixon-switch plugin, swupdate |
| `dynamic-layers/rtl83xx-bsp/.../rtl83xx-image-common.inc` | the packagegroup, `ssh-server-dropbear` and the `cli` user, required by the `rtl83xx-image-initramfs` and `rtl83xx-image` bbappends |
| `dynamic-layers/rtl83xx-bsp/recipes-images/swupdate/` | `rtl83xx-swu-factory` and `rtl83xx-swu-upgrade` with their sw-descriptions |
| `recipes-clixon/cligen/`, `recipes-clixon/clixon/` | clixon 7.8.0 with native RESTCONF (HTTP/1, no nghttp2) |
| `recipes-clixon/clixon-switch/` | the backend plugin (cargo) with its YANG, `/etc/clixon.xml`, clispec, autocli and factory default (`RTL_LAN_PORTS`, `RTL_LAN_ADDRESS`); init scripts, RESTCONF's in `-restconf` |
| `recipes-support/swupdate/` | kconfig fragment (U-Boot env, MTD flash handler), web port, `/etc/hwrevision`, `20-rtl83xx-mode` (software set selection, SWUpdate from RAM) |
