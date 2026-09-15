SUMMARY = "YANG-based configuration manager"
DESCRIPTION = "Clixon provides a transactional configuration datastore with \
a CLI, NETCONF and RESTCONF generated from YANG. RESTCONF uses the native \
embedded HTTP/1 server."
HOMEPAGE = "https://www.clicon.org/"
SECTION = "net"
LICENSE = "Apache-2.0 | GPL-3.0-only"
LIC_FILES_CHKSUM = "file://LICENSE.md;md5=55a6a303edda663ff84f496c4a9f9206"

SRC_URI = "git://github.com/clicon/clixon.git;protocol=https;branch=master"
SRCREV = "62a901b1c6215703a7c37e1ff4d51a155587af7d"

# openssl: libclixon uses SHA from libcrypto (lib/src/clixon_digest.c), and
# native RESTCONF links libssl even when no socket has TLS enabled.
DEPENDS = "cligen openssl flex-native bison-native"

# Hand-written Makefile.in (no automake) that builds in the source tree.
inherit autotools-brokensep useradd

# cligen is found in the recipe sysroot, so no --with-cligen. The default
# config file lets clixon_cli run without -f, which it has to as a login shell.
# Native RESTCONF without nghttp2 serves HTTP/1 only (no fcgi, so no nginx).
EXTRA_OECONF = " \
    --with-restconf=native \
    --disable-nghttp2 \
    --with-configfile=${sysconfdir}/clixon.xml \
"

# See cligen: keep configure from defaulting to "install -s".
export INSTALLFLAGS = ""

do_configure:prepend() {
    # scripts/version.sh derives the soname from "git describe" unless
    # .version exists; the fetched checkout has no tags to describe.
    echo "${PV}" > ${S}/.version
}

# configure bakes the absolute paths of the build host's tools (hosttools/grep,
# ...) into include/clixon_config.h, for the CLI pipe commands and the NETCONF
# ssh client. Point them at the target's busybox and dropbear links instead.
do_configure:append() {
    sed -i \
        -e 's|^#define CAT_BIN .*|#define CAT_BIN "${base_bindir}/cat"|' \
        -e 's|^#define GREP_BIN .*|#define GREP_BIN "${base_bindir}/grep"|' \
        -e 's|^#define TAIL_BIN .*|#define TAIL_BIN "${bindir}/tail"|' \
        -e 's|^#define WC_BIN .*|#define WC_BIN "${bindir}/wc"|' \
        -e 's|^#define SSH_BIN .*|#define SSH_BIN "${bindir}/ssh"|' \
        ${B}/include/clixon_config.h
}

# CLICON_SOCK_GROUP: members of this group may connect to the backend socket.
# CLICON_RESTCONF_USER: clixon_restconf binds its port as root, then drops to
# this user (CLICON_RESTCONF_PRIVILEGES drop_perm).
USERADD_PACKAGES = "${PN}"
GROUPADD_PARAM:${PN} = "--system clicon"
USERADD_PARAM:${PN} = "--system --no-create-home --home-dir /nonexistent \
    --shell /bin/false --gid clicon clicon"
