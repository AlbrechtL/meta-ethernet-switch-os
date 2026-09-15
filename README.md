# meta-rtl83xx-distro

Userspace policy for RTL83xx switches, on top of `meta-rtl83xx-bsp`:

- A boot script bridges `lan1`..`lan8` into `br-lan` with **192.168.1.1/24**
- [clixon](https://www.clicon.org/) with the eth-switch YANG model from
  [managed-switch-yang-netconf-cli-docker](https://github.com/AlbrechtL/managed-switch-yang-netconf-cli-docker).
  `ssh cli@192.168.1.1` opens the clixon CLI directly, and RESTCONF answers on
  **http://192.168.1.1/restconf** (plain HTTP/1, no authentication). There is
  no backend plugin yet, so configuration is stored in the datastore but not
  applied.
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
| `recipes-core/packagegroups/packagegroup-rtl83xx-base.bb` | network script, clixon, swupdate |
| `dynamic-layers/rtl83xx-bsp/.../rtl83xx-image-common.inc` | the packagegroup, `ssh-server-dropbear` and the `cli` user, required by the `rtl83xx-image-initramfs` and `rtl83xx-image` bbappends |
| `dynamic-layers/rtl83xx-bsp/recipes-images/swupdate/` | `rtl83xx-swu-factory` and `rtl83xx-swu-upgrade` with their sw-descriptions |
| `recipes-connectivity/rtl83xx-network-init/` | `/etc/init.d/rtl83xx-network`: static `br-lan` with busybox `ip` |
| `recipes-clixon/cligen/`, `recipes-clixon/clixon/` | clixon 7.8.0 with native RESTCONF (HTTP/1, no nghttp2) |
| `recipes-clixon/rtl83xx-clixon-config/` | `/etc/clixon.xml`, clispec, autocli, YANG, init scripts; RESTCONF's in `-restconf` |
| `recipes-support/swupdate/` | kconfig fragment (U-Boot env, MTD flash handler), web port, `/etc/hwrevision`, `20-rtl83xx-mode` (software set selection, SWUpdate from RAM) |
