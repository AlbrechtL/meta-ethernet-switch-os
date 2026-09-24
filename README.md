# meta-ethernet-switch-os

> **⚠️ Proof of concept.** This project is a proof of concept, created with
> the help of AI. It has not undergone thorough review or hardening, and
> should not be assumed suitable for production use.

Part of **Ethernet Switch OS**. The build lives in
[ethernet-switch-os](https://github.com/AlbrechtL/ethernet-switch-os), which
checks this layer out with [kas](https://kas.readthedocs.io/) and builds the
images. The other pieces are
[clixon-switch-rs](https://github.com/AlbrechtL/clixon-switch-rs) (the backend
plugin), [meta-rtl83xx-bsp](https://github.com/AlbrechtL/meta-rtl83xx-bsp)
(the hardware) and [rtl838x-qemu](https://github.com/AlbrechtL/rtl838x-qemu)
(testing without hardware).

Userspace policy for RTL83xx switches, on top of `meta-rtl83xx-bsp`:

- [clixon](https://www.clicon.org/) with the
  [clixon-switch](https://github.com/AlbrechtL/clixon-switch-rs) backend
  plugin (Rust), which configures the network from an OpenConfig
  configuration. Factory default: `lan1`..`lan8` as access ports in VLAN 1 of
  the VLAN-aware bridge `br-lan`, and **192.168.1.1/24** on `vlan1`.
  `ssh cli@192.168.1.1` opens the clixon CLI directly, and RESTCONF answers on
  **http://192.168.1.1/restconf** (plain HTTP/1, no authentication). A
  read-only status page (system, management address, ports, VLANs) on
  **http://192.168.1.1/** is served by `clixon_restconf` as well and reads
  only RESTCONF; it links to the SWUpdate web UI. A commit
  applies a change; only `save` (or a copy-config to startup) makes it survive
  a reboot. Spanning tree (STP, RSTP, MSTP, OpenConfig `/stp`) runs in
  mstpd, managed by the plugin; it is off by default. So is the read-only
  SNMPv3 agent (ietf-snmp `/snmp`): net-snmp's snmpd for the system group
  and IF-MIB, clixon_snmp for BRIDGE-MIB, Q-BRIDGE-MIB and RSTP-MIB.
- dropbear SSH (`ssh root@192.168.1.1` for a shell). Both `root` and `cli`
  have an empty password via the `core/yocto/root-login-with-empty-password`
  fragment -- proof of concept only.
- SWUpdate daemon with its web UI on **http://192.168.1.1:8080**, plus two
  .swu images for the BSP's flash layout: `ethernet-switch-os-swu-factory`
  (first install from the TFTP initramfs) and
  `ethernet-switch-os-swu-upgrade` (update in place, user data kept).
  See "Flash image" in `meta-rtl83xx-bsp`'s README.

No NetworkManager, D-Bus, udev or systemd: busybox is init and mdev.

The BSP stays hardware-only and boots without this layer.

See [TECHNICAL.md](TECHNICAL.md) for the clixon layout on the target and
known traps/pitfalls.

## Building

Not built on its own.
[ethernet-switch-os](https://github.com/AlbrechtL/ethernet-switch-os) holds the
whole build configuration -- which layers, which branches, which machine -- and
checks them out with kas:

```sh
git clone https://github.com/AlbrechtL/ethernet-switch-os
cd ethernet-switch-os
make container      # the development image, once
make build
```

This layer lands in `layers/meta-ethernet-switch-os`, an ordinary clone of
`master` that can be edited and committed in place.

### What the layer needs

| Layer | Branch |
|---|---|
| openembedded-core (`meta`) | wrynose |
| meta-yocto (`meta-poky`) | wrynose |
| meta-openembedded (`meta-oe`, `meta-python`, `meta-networking`) | wrynose |
| meta-swupdate | wrynose |

No revisions here: `kas/os.yml` in the build repository is the list that is
actually used, and it follows the branch tips.

`meta-poky` is only there for `conf/distro/poky-tiny.conf`, which this layer's
distro requires. `meta-networking` provides net-snmp. Nothing here builds from
`meta-python`, but `meta-networking` declares it in `LAYERDEPENDS`, so it has
to be enabled too or parsing stops with "layer 'networking-layer' depends on
layer 'meta-python'".

`meta-rtl83xx-bsp` is deliberately *not* a dependency. `LAYERDEPENDS` does not
name it, and the image and `.swu` recipes under `dynamic-layers/rtl83xx-bsp/`
are only parsed where that layer is present -- which is what lets a second BSP
be added without touching this one.

## Built images

`bitbake ethernet-switch-os-swu-factory ethernet-switch-os-swu-upgrade` --
the default target of the board file in the build repository -- lands in
`build/tmp/deploy/images/zyxel-gs1900-8-a1/`:

| File | What it is for |
|---|---|
| `ethernet-switch-os-initramfs-zyxel-gs1900-8-a1.bin` | TFTP boot image; the first install and recovery run entirely from RAM. |
| `ethernet-switch-os-swu-factory-zyxel-gs1900-8-a1.swu` | First install, uploaded from the TFTP initramfs. Writes `firmware`, wipes `data`. |
| `ethernet-switch-os-swu-upgrade-zyxel-gs1900-8-a1.swu` | Update in place. Rewrites `firmware`, keeps `data`. |

The boot images carry `${DISTRO}` and `${MACHINE}`, so they say which OS
and which board they are for. See the image table in `meta-rtl83xx-bsp`'s
README for the intermediate artifacts.

The images themselves are built by CI in
[ethernet-switch-os](https://github.com/AlbrechtL/ethernet-switch-os), which is
where the layer revisions live. What runs here is
`.github/workflows/check.yml`: it parses this layer inside that same build
configuration on every push and pull request, without executing a task, so a
broken recipe or a missing dependency shows up in minutes instead of after a
full build.

## Contents

| File | Role |
|---|---|
| `conf/distro/ethernet-switch-os.conf` | poky-tiny + the `sysvinit` script machinery |
| `recipes-core/packagegroups/packagegroup-ethernet-switch-os-base.bb` | clixon with the clixon-switch plugin, swupdate |
| `dynamic-layers/rtl83xx-bsp/.../ethernet-switch-os-image-common.inc` | the packagegroup, `ssh-server-dropbear` and the `cli` user, required by the `rtl83xx-image-initramfs` and `rtl83xx-image` bbappends |
| `dynamic-layers/rtl83xx-bsp/recipes-images/swupdate/` | `ethernet-switch-os-swu-factory` and `ethernet-switch-os-swu-upgrade` with their sw-descriptions |
| `recipes-clixon/cligen/`, `recipes-clixon/clixon/` | clixon 7.8.0 with native RESTCONF (HTTP/1, no nghttp2), and `clixon_snmp` in `clixon-snmp`, patched for the bridge MIBs |
| `recipes-clixon/clixon-switch/` | the backend plugin (cargo) with its YANG, `/etc/clixon.xml`, clispec, autocli and factory default (`ETHERNET_SWITCH_OS_LAN_PORTS`, `ETHERNET_SWITCH_OS_LAN_ADDRESS`); init scripts, RESTCONF's in `-restconf` |
| `recipes-webui/ethernet-switch-os-webui/` | the status page itself (`files/www`: plain HTML, CSS and JavaScript, no build step), installed to the `http-data` root `clixon-switch_git.bb` passes as `HTTP_DATA_ROOT` |
| `recipes-networking/mstpd/` | mstpd from meta-oe, patched to program the kernel's per-VLAN spanning tree (MSTP), which the rtl83xx driver offloads |
| `recipes-networking/net-snmp/` | net-snmp from meta-networking as a minimal SNMPv3-only agent without its init script or MIB files |
| `recipes-support/swupdate/` | kconfig fragment (U-Boot env, MTD flash handler), web port, `/etc/hwrevision`, `20-ethernet-switch-os-mode` (software set selection, SWUpdate from RAM) |
| `recipes-core/base-files/` | login banner (`/etc/issue`, `/etc/issue.net`, `/etc/motd`) pointing at `clixon_cli`, overriding oe-core/poky's via the `ethernet-switch-os` `FILESEXTRAPATHS` override |
