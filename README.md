# meta-ethernet-switch-os

> **⚠️ Proof of concept.** This project is a proof of concept, created with
> the help of AI. It has not undergone thorough review or hardening, and
> should not be assumed suitable for production use.

Part of **Ethernet Switch OS**. The build lives in
[ethernet-switch-os](https://github.com/AlbrechtL/ethernet-switch-os), which
checks this layer out with [kas](https://kas.readthedocs.io/) and builds the
images. The other pieces are
[clixon-switch-rs](https://github.com/AlbrechtL/clixon-switch-rs) (the backend
plugin), the BSP layers
([meta-rtl83xx-bsp](https://github.com/AlbrechtL/meta-rtl83xx-bsp),
[meta-rpi-managed-switch-bsp](https://github.com/AlbrechtL/meta-rpi-managed-switch-bsp),
[meta-qemu-switch-bsp](https://github.com/AlbrechtL/meta-qemu-switch-bsp))
for the hardware and [rtl838x-qemu](https://github.com/AlbrechtL/rtl838x-qemu)
(testing without hardware).

This is the **distro and userspace layer**: the policy that turns a BSP into
a managed switch. It provides the `ethernet-switch-os` distro (poky-tiny with
busybox as init and mdev, no systemd or D-Bus), and on top of any of the
BSPs:

- [clixon](https://www.clicon.org/) with the clixon-switch backend plugin,
  which configures the network from an OpenConfig configuration; the CLI,
  RESTCONF and the status and settings web page;
- spanning tree (mstpd, patched for per-VLAN MSTP) and the SNMPv3 agent;
- dropbear SSH;
- SWUpdate with its web UI, and the `.swu` images (`ethernet-switch-os-swu-factory`
  and `ethernet-switch-os-swu-upgrade`) for each BSP's flash or disk layout.

The BSPs stay hardware-only and boot without this layer. The same userspace
runs on all of them; each BSP is reached through `BBFILES_DYNAMIC` from
`dynamic-layers/<collection>/`, only when that BSP layer is present.

## Documentation

**Using the firmware is documented in the user guide, which is the only place
for that information:** [Ethernet Switch OS](https://albrechtl.github.io/ethernet-switch-os/).
Start with [Installation](https://albrechtl.github.io/ethernet-switch-os/installation/download/)
and [First login](https://albrechtl.github.io/ethernet-switch-os/installation/first-login/);
[Firmware architecture](https://albrechtl.github.io/ethernet-switch-os/development/architecture/)
explains how the pieces fit together.

For developers, [TECHNICAL.md](TECHNICAL.md) has the clixon layout on the
target, how the web page is served, and known traps.

## Building

Not built on its own.
[ethernet-switch-os](https://github.com/AlbrechtL/ethernet-switch-os) holds the
whole build configuration -- which layers, which branches, which machine -- and
checks them out with kas, see
[Building the firmware](https://albrechtl.github.io/ethernet-switch-os/development/building/).
