# lighttpd as the HTTPS front end: TLS and the password check for
# clixon_restconf and SWUpdate, which only listen on 127.0.0.1 (see
# files/lighttpd.conf). The configuration and the init script replace
# oe-core's, found first through FILESEXTRAPATHS.

FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# No pcre, zlib or xattr: the configuration uses no regular expressions and
# nothing is compressed. OpenSSL is in the image anyway, for clixon.
PACKAGECONFIG = "openssl"
# with_pcre2 defaults to on and wins over PACKAGECONFIG's -Dwith_pcre=disabled.
EXTRA_OEMESON += "-Dwith_pcre2=false"

# Not dirlisting and accesslog: nothing is listed, and access logs would only
# fill the RAM.
RDEPENDS:${PN}:remove = "lighttpd-module-dirlisting"
RRECOMMENDS:${PN}:remove = "lighttpd-module-accesslog"
# The modules lighttpd.conf loads. openssl-bin: the init script makes the
# certificate with "openssl req".
RDEPENDS:${PN} += " \
    lighttpd-module-openssl \
    lighttpd-module-auth \
    lighttpd-module-authn-file \
    lighttpd-module-proxy \
    openssl-bin \
"

# After clixon-restconf (35), which it forwards to.
INITSCRIPT_PARAMS = "defaults 40"

# lighttpd binds port 443 as root and then runs as this user. The htpasswd
# file belongs to its group.
inherit useradd
USERADD_PACKAGES = "${PN}"
USERADD_PARAM:${PN} = "--system --no-create-home --home-dir /nonexistent \
    --shell /bin/false --user-group lighttpd"

do_install:append() {
    # oe-core's demo page and its log symlinks. The web interface lives in
    # /usr/share/ethernet-switch-os/www (ethernet-switch-os-webui).
    rm -rf ${D}/www
}
