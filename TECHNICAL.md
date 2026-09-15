# meta-rtl83xx-distro — technical notes

Deep-dive background for [README.md](README.md): the clixon layout on the
target, and traps worth remembering.

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
