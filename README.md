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
- SWUpdate daemon with its web UI on **http://192.168.1.1:8080**. No
  bootloader integration and no flash handlers yet.

No NetworkManager, D-Bus, udev or systemd: busybox is init and mdev.

The BSP stays hardware-only and boots without this layer.

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
| `dynamic-layers/rtl83xx-bsp/.../rtl83xx-image-initramfs.bbappend` | adds the packagegroup, `ssh-server-dropbear` and the `cli` user |
| `recipes-connectivity/rtl83xx-network-init/` | `/etc/init.d/rtl83xx-network`: static `br-lan` with busybox `ip` |
| `recipes-clixon/cligen/`, `recipes-clixon/clixon/` | clixon 7.8.0 with native RESTCONF (HTTP/1, no nghttp2) |
| `recipes-clixon/rtl83xx-clixon-config/` | `/etc/clixon.xml`, clispec, autocli, YANG, init scripts; RESTCONF's in `-restconf` |
| `recipes-support/swupdate/` | kconfig fragment, web port, `/etc/hwrevision` |

## clixon layout on the target

| Path | Content |
|---|---|
| `/etc/clixon.xml` | main config; clixon's compiled-in default, so no `-f` needed |
| `/etc/clixon/eth-switch/autocli.xml` | limits the generated CLI to the OpenConfig modules |
| `/usr/lib/eth-switch/clispec/` | `eth-switch_cli.cli` |
| `/usr/lib/eth-switch/backend/` | empty -- the backend plugin goes here |
| `/usr/share/eth-switch/yang/` | the main module and its imports |
| `/var/lib/clixon/eth-switch/` | datastores (RAM, lost on reboot) |
| `/var/run/eth-switch.sock` | backend socket, group `clicon` |

`/etc/init.d/clixon-backend` starts `clixon_backend` in `CLICON_STARTUP_MODE`
`init`, i.e. with an empty running datastore.

`/etc/init.d/clixon-restconf` starts `clixon_restconf`, which binds port 80 as
root and then drops to user `clicon`. Its listener is the `<restconf>` block in
`/etc/clixon.xml`:

```sh
curl http://192.168.1.1/restconf/data/openconfig-interfaces:interfaces
curl -X PUT -H 'Content-Type: application/yang-data+json' \
    -d '{"openconfig-interfaces:interface":[{"name":"lan1","config":{"name":"lan1"}}]}' \
    http://192.168.1.1/restconf/data/openconfig-interfaces:interfaces/interface=lan1
```

## Traps

**RESTCONF config lives in `/etc/clixon.xml`, not in the datastore.** The
reference container sets `CLICON_BACKEND_RESTCONF_PROCESS` so that the backend
spawns `clixon_restconf` from the `<restconf>` config in `startup_db`. With
`CLICON_STARTUP_MODE` `init` there is no startup db, so that daemon would never
start. Here the option is false: an init script starts the daemon, which then
reads the `<restconf>` block from the config file. `clixon_restconf` has no
daemon mode of its own, hence `start-stop-daemon -b -m`.

**dropbear checks `/etc/shells`.** A user whose login shell is not listed is
rejected with "User 'cli' has invalid shell, rejected" in syslog, and the client
only sees a failed password. base-files lists just `/bin/sh`;
`rtl83xx-clixon-config` appends `/usr/bin/clixon_cli` in its postinst.

**`CLICON_CONFIGDIR` is not recursive.** It loads `*.xml` from exactly that
directory. The reference container points it at `/usr/local/etc/clixon` while
`autocli.xml` sits in the `eth-switch/` subdirectory, so there it is never read.
Here the configdir *is* that subdirectory.

**clixon needs OpenSSL even without TLS.** `libclixon` hashes with
`openssl/sha.h` (`clixon_digest.c`), and native RESTCONF links libssl whether or
not a socket has `<ssl>true</ssl>`. libcrypto is by far the largest library in
the image.

**cligen/clixon configure strip on install.** `INSTALLFLAGS` defaults to `-s`,
which runs the host `strip` over MIPS binaries. It is only defaulted when unset,
so the recipes export it empty.

**cligen/clixon take their soname from `git describe`.** `scripts/version.sh`
reads `.version` first; the recipes write `${PV}` there, because the fetched
checkout has no tags.

**poky-tiny has no `sysvinit` distro feature, and nothing starts without it.**
`update-rc.d.bbclass` only creates `/etc/rc*.d` links when the feature is set.
The image still builds without complaint; the result is a rootfs with every
daemon present and none running. `rtl83xx-tiny` appends `sysvinit`, while
busybox stays PID 1. Check after a build that `rootfs/etc/rc5.d` exists.

**poky-tiny ships no `/etc/init.d/functions`.** The swupdate init script sources
it and exits silently without it, hence `initd-functions` in its bbappend.

**`eth0` gets no address on purpose.** It is the DSA conduit. The network script
only sets it up; `init-ifupdown` is a bad recommendation because its default
`/etc/network/interfaces` would run DHCP on it.

Find the next size offender with `readelf -d` over the rootfs (`NEEDED`
entries) rather than grepping pkgdata.
