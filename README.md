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
  configuration. Factory default: all front ports (`lan1`..`lan8` on the
  GS1900-8, per board in `conf/distro/include/ethernet-switch-os-boards.inc`)
  as access ports in VLAN 1 of the VLAN-aware bridge `br-lan`, and
  **192.168.1.1/24** on `vlan1`.
  `ssh cli@192.168.1.1` opens the clixon CLI directly, and RESTCONF answers on
  **http://192.168.1.1/restconf** (plain HTTP/1, no authentication). A
  status and settings page (system, management address, ports, VLANs,
  spanning tree, SNMP) on **http://192.168.1.1/** is served by
  `clixon_restconf` as well and only talks RESTCONF; it links to the
  SWUpdate web UI. A commit
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

The same userspace runs on the other BSPs, each reached through
`BBFILES_DYNAMIC` from `dynamic-layers/<collection>/` only when that BSP
layer is present: the Raspberry Pi switch (`rpi-managed-switch-bsp`, A/B with
U-Boot) and the emulated QEMU x86-64 switch (`qemu-switch-bsp`, A/B with EFI
Boot Guard). On the QEMU switch the front ports are virtio-net devices rather
than DSA ports, so the image names them to the plugin in
`/etc/default/clixon-backend` (`CLIXON_SWITCH_PORTS`), and SWUpdate is built
with the EFI Boot Guard bootloader interface instead of U-Boot's.

The BSP stays hardware-only and boots without this layer.

See [TECHNICAL.md](TECHNICAL.md) for the clixon layout on the target and
known traps/pitfalls.

## Building

Not built on its own.
[ethernet-switch-os](https://github.com/AlbrechtL/ethernet-switch-os) holds the
whole build configuration -- which layers, which branches, which machine -- and
checks them out with kas:
