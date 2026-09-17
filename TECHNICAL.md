# meta-ethernet-switch-os — technical notes

Deep-dive background for [README.md](README.md): the clixon layout on the
target, and traps worth remembering.

## clixon layout on the target

| Path | Content |
|---|---|
| `/etc/clixon.xml` | main config; clixon's compiled-in default, so no `-f` needed |
| `/etc/clixon/clixon-switch/autocli.xml` | limits the generated CLI to the OpenConfig modules |
| `/usr/lib/clixon-switch/clispec/` | `clixon-switch_cli.cli` |
| `/usr/lib/clixon-switch/backend/` | `clixon-switch_backend.so`, the plugin |
| `/usr/lib/clixon-switch/prepare-datastore` | run by the init script before the backend starts |
| `/sbin/bridge-stp` | link to `/usr/lib/clixon-switch/bridge-stp`, run by the kernel when spanning tree is switched on |
| `/usr/sbin/mstpd`, `/usr/sbin/mstpctl` | spanning tree daemon, started by the plugin while `/stp` enables a protocol |
| `/usr/share/clixon-switch/yang/` | the main module and its OpenConfig imports |
| `/usr/share/clixon-switch/factory-default.xml` | first-boot configuration, and the failsafe |
| `/var/run/clixon-switch/` | datastores (tmpfs); `startup_db` is a symlink to... |
| `/var/lib/clixon/clixon-switch/startup_db` | ...the saved configuration (flash, kept on upgrade) |
| `/var/run/clixon-switch.sock` | backend socket, group `clicon` |

`/etc/init.d/clixon-backend` (S05, the network comes from it) runs
`prepare-datastore`, then starts `clixon_backend` in `CLICON_STARTUP_MODE`
`startup`. The backend commits `startup_db` through the plugin, which creates
`br-lan`, adds the ports and puts the address on `vlan1`. If that commit
fails, clixon commits `failsafe_db`, the factory default.

`/etc/init.d/clixon-restconf` starts `clixon_restconf`, which binds port 80 as
root and then drops to user `clicon`. Its listener is the `<restconf>` block in
`/etc/clixon.xml`:

```sh
curl http://192.168.1.1/restconf/data/openconfig-interfaces:interfaces
# lan3 into VLAN 20, which has to be declared first: applied at once, lost
# on reboot...
curl -X PATCH -H 'Content-Type: application/yang-data+json' \
    -d '{"clixon-switch:vlans":{"vlan":[{"vlan-id":20,"config":{"vlan-id":20}}]}}' \
    http://192.168.1.1/restconf/data/clixon-switch:vlans
curl -X PATCH -H 'Content-Type: application/yang-data+json' \
    -d '{"openconfig-vlan:config":{"interface-mode":"ACCESS","access-vlan":20}}' \
    http://192.168.1.1/restconf/data/openconfig-interfaces:interfaces/interface=lan3/openconfig-if-ethernet:ethernet/openconfig-vlan:switched-vlan/config
# DHCP client on vlan1, next to the static address
curl -X PATCH -H 'Content-Type: application/yang-data+json' \
    -d '{"openconfig-if-ip:ipv4":{"config":{"dhcp-client":true}}}' \
    http://192.168.1.1/restconf/data/openconfig-interfaces:interfaces/interface=vlan1/openconfig-vlan:routed-vlan/openconfig-if-ip:ipv4
# ...until saved
curl -X POST -H 'Content-Type: application/yang-data+json' \
    -d '{"ietf-netconf:input":{"target":{"startup":[null]},"source":{"running":[null]}}}' \
    http://192.168.1.1/restconf/operations/ietf-netconf:copy-config
```

Factory reset: `rm /var/lib/clixon/clixon-switch/startup_db` and reboot.

## Traps

**Only `startup_db` may live on flash.** clixon rewrites `candidate_db` and
`running_db` in `CLICON_XMLDB_DIR` on every edit. The directory is therefore
on tmpfs, and `prepare-datastore` links `startup_db` to the saved file in
`/var/lib`. A copy-config to startup writes through the link.

**`deviate not-supported` does not reject anything in clixon 7.8.** It only
skips `must` checks for the node; data for it is still accepted and stored.
The plugin therefore rejects unimplemented configuration itself when
validating a commit. clixon also fills YANG defaults into every tree
(`loopback-mode NONE`, IPv6 defaults, ...), so unimplemented leaves are
accepted with their default value.

**RESTCONF config lives in `/etc/clixon.xml`, not in the datastore.** The
reference container sets `CLICON_BACKEND_RESTCONF_PROCESS` so that the backend
spawns `clixon_restconf` from the `<restconf>` config in `startup_db`. Here the
option is false: an init script starts the daemon, which then reads the
`<restconf>` block from the config file, so the listener cannot be configured
away over RESTCONF itself. `clixon_restconf` has no daemon mode of its own,
hence `start-stop-daemon -b -m`.

**`openconfig-if-ip` must stay at 3.7.0 or older.** From 3.8.0 (openconfig/public
v5.4.0) it imports `openconfig-network-instance`, which pulls BGP, IS-IS, OSPF,
MPLS and more into clixon's YANG parser. clixon-switch-rs vendors v5.3.0, and
its `vendor-yang.sh` refuses a closure that contains network-instance.

**Rust on mips is a tier-3 target.** oe-core builds the standard library from
source for `mips32r2-24kc` musl, but its Rust selftests skip mips, so nothing
upstream tests it.

**dropbear checks `/etc/shells`.** A user whose login shell is not listed is
rejected with "User 'cli' has invalid shell, rejected" in syslog, and the client
only sees a failed password. base-files lists just `/bin/sh`;
`clixon-switch` appends `/usr/bin/clixon_cli` in its postinst.

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
daemon present and none running. `ethernet-switch-os` appends `sysvinit`, while
busybox stays PID 1. Check after a build that `rootfs/etc/rc5.d` exists.

**poky-tiny ships no `/etc/init.d/functions`.** The swupdate init script sources
it and exits silently without it, hence `initd-functions` in its bbappend.

**`eth0` gets no address on purpose.** It is the DSA conduit. The plugin only
sets it up; `init-ifupdown` is a bad recommendation because its default
`/etc/network/interfaces` would run DHCP on it.

**DHCP addresses are told apart by their lifetime.** The plugin reconciles
the kernel with the configuration and removes addresses it does not know.
The udhcpc script (clixon-switch-rs `scripts/udhcpc-script.sh`) adds the
leased address with `valid_lft`/`preferred_lft` set to the lease time.
The kernel then does not flag it `IFA_F_PERMANENT`, and the plugin keeps
such addresses on the interface that runs the DHCP client. The plugin, not an
init script, starts and stops udhcpc, because only the plugin knows whether
the running configuration has `dhcp-client` set. `/etc/resolv.conf` is a
symlink into `/var/run`, so lease renewals do not write to flash.

**The kernel leaves spanning tree to mstpd only through `/sbin/bridge-stp`.**
Setting `stp_state` 1 on a bridge makes the kernel run that fixed path; if it
is missing or fails, the kernel silently runs its own 802.1D STP instead.
clixon-switch installs a script that always succeeds (it starts mstpd itself,
first) and fails the commit if the kernel still chose its own STP. mstpd's
own `bridge-stp` lands in `/usr/sbin`, where the kernel does not look. Only
bridges in the host's network namespace get userspace STP at all, which is
why the dev container cannot test loops.

**Stock mstpd does not do MSTP in the data plane.** It computes the port
states of every MSTI but only passes the CIST's to the kernel.
`recipes-networking/mstpd` patches it to use the kernel's per-VLAN spanning
tree (bridge `mst_enable`, Linux 5.18+), which the rtl83xx driver offloads
(64 MST slots on the RTL838x). `mst_enable` can only change while no bridge
port has a VLAN, so the plugin creates `br-lan` with it, always.

**mstpctl needs CAP_SYS_ADMIN in mstpd's answer.** mstpd replies with the
client's `SCM_CREDENTIALS` still attached, which the kernel only allows with
CAP_SYS_ADMIN. clixon_backend runs as root here; a container needs
`--cap-add SYS_ADMIN`.

Find the next size offender with `readelf -d` over the rootfs (`NEEDED`
entries) rather than grepping pkgdata.
