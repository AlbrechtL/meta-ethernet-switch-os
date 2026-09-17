# meta-ethernet-switch-os

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

## Layers

| Layer | Branch | Pinned at |
|---|---|---|
| meta-openembedded (`meta-oe`, `meta-networking`) | wrynose | `14282a02be9c74a1276a7cda7d6c89e054699a11` |
| meta-swupdate (`https://github.com/sbabic/meta-swupdate`) | wrynose | `c0658455606b3a37d85d7cf03703d8b8d2ead667` |

```sh
cd layers
git clone -b wrynose https://git.openembedded.org/meta-openembedded
git clone -b wrynose https://github.com/sbabic/meta-swupdate
cd ../build && . init-build-env
bitbake-layers add-layer ../layers/meta-openembedded/meta-oe \
    ../layers/meta-openembedded/meta-networking \
    ../layers/meta-swupdate ../layers/meta-ethernet-switch-os
bitbake-config-build disable-fragment distro/poky-tiny
bitbake-config-build enable-fragment distro/ethernet-switch-os
bitbake-config-build enable-fragment machine/zyxel-gs1900-8-a1
```

`meta-networking` provides net-snmp. `meta-python` is no longer required (it
was for NetworkManager); leaving it in `bblayers.conf` is harmless.

These layers (and `meta-rtl83xx-bsp`) are added by hand, not through
`config/config-upstream.json`, so a `bitbake-setup update` that regenerates
`bblayers.conf` drops them again.

## Built images

```sh
bitbake ethernet-switch-os-swu-factory ethernet-switch-os-swu-upgrade
```

lands in `build/tmp/deploy/images/zyxel-gs1900-8-a1/`:

| File | What it is for |
|---|---|
| `ethernet-switch-os-initramfs-zyxel-gs1900-8-a1.bin` | TFTP boot image; the first install and recovery run entirely from RAM. |
| `ethernet-switch-os-swu-factory-zyxel-gs1900-8-a1.swu` | First install, uploaded from the TFTP initramfs. Writes `firmware`, wipes `data`. |
| `ethernet-switch-os-swu-upgrade-zyxel-gs1900-8-a1.swu` | Update in place. Rewrites `firmware`, keeps `data`. |

The boot images carry `${DISTRO}` and `${MACHINE}`, so they say which OS
and which board they are for. See the image table in `meta-rtl83xx-bsp`'s
README for the intermediate artifacts.

`.github/workflows/build.yml` builds exactly these on every push to
`master` and on pull requests, and uploads them as a job artifact. The
layer revisions it clones are pinned in the workflow's `env:` block; keep
them in step with the table above.

## Contents

| File | Role |
|---|---|
| `conf/distro/ethernet-switch-os.conf` | poky-tiny + the `sysvinit` script machinery |
| `recipes-core/packagegroups/packagegroup-ethernet-switch-os-base.bb` | clixon with the clixon-switch plugin, swupdate |
| `dynamic-layers/rtl83xx-bsp/.../ethernet-switch-os-image-common.inc` | the packagegroup, `ssh-server-dropbear` and the `cli` user, required by the `rtl83xx-image-initramfs` and `rtl83xx-image` bbappends |
| `dynamic-layers/rtl83xx-bsp/recipes-images/swupdate/` | `ethernet-switch-os-swu-factory` and `ethernet-switch-os-swu-upgrade` with their sw-descriptions |
| `recipes-clixon/cligen/`, `recipes-clixon/clixon/` | clixon 7.8.0 with native RESTCONF (HTTP/1, no nghttp2), and `clixon_snmp` in `clixon-snmp`, patched for the bridge MIBs |
| `recipes-clixon/clixon-switch/` | the backend plugin (cargo) with its YANG, `/etc/clixon.xml`, clispec, autocli and factory default (`ETHERNET_SWITCH_OS_LAN_PORTS`, `ETHERNET_SWITCH_OS_LAN_ADDRESS`); init scripts, RESTCONF's in `-restconf`; the status page in `-www` |
| `recipes-networking/mstpd/` | mstpd from meta-oe, patched to program the kernel's per-VLAN spanning tree (MSTP), which the rtl83xx driver offloads |
| `recipes-networking/net-snmp/` | net-snmp from meta-networking as a minimal SNMPv3-only agent without its init script or MIB files |
| `recipes-support/swupdate/` | kconfig fragment (U-Boot env, MTD flash handler), web port, `/etc/hwrevision`, `20-ethernet-switch-os-mode` (software set selection, SWUpdate from RAM) |
| `recipes-core/base-files/` | login banner (`/etc/issue`, `/etc/issue.net`, `/etc/motd`) pointing at `clixon_cli`, overriding oe-core/poky's via the `ethernet-switch-os` `FILESEXTRAPATHS` override |
