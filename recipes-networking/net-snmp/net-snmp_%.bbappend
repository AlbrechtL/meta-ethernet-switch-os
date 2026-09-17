# snmpd for SNMPv3 polling only, run by the clixon-switch backend plugin
# (which writes its configuration). It answers the system group and IF-MIB
# itself; clixon_snmp (clixon-snmp) serves the bridge MIBs over AgentX.
#
# A minimal agent: no SNMPv1/v2c, no MD5/DES, USM only, UDP and Unix sockets
# (AgentX), no MIB parser (OIDs are numeric), no client applications. Write
# support stays: clixon_snmp does not build without it (MODE_SET_*); nothing
# is writable anyway, the plugin configures no write view. libpci only names PCI devices in ifDescr; the switch has none.
PACKAGECONFIG:remove = "smux"
MIB_MODULES = "if-mib agentx"
EXTRA_OECONF += " \
    --enable-mini-agent \
    --disable-snmpv1 \
    --disable-snmpv2c \
    --disable-md5 \
    --disable-des \
    --with-security-modules=usm \
    --with-transports='UDP Unix Callback' \
    --with-out-transports='TCP TCPIPv6 UDPIPv6 SSH DTLSUDP TLSTCP AAL5PVC IPX' \
    --disable-mib-loading \
    --disable-applications \
    --disable-scripts \
"
DEPENDS:remove:class-target = "pciutils"
CACHED_CONFIGUREVARS += "ac_cv_search_pci_lookup_name=no"
RDEPENDS:${PN}-libs:remove:class-target = "libpci"

# No MIB text files on flash: the agent does not parse MIBs.
RDEPENDS:${PN}-server-snmpd:remove = "net-snmp-mibs"

# The plugin starts snmpd with its own configuration while /snmp enables it.
INITSCRIPT_PACKAGES = ""
CONFFILES:${PN}-server-snmpd = ""
do_install:append() {
    rm -f ${D}${sysconfdir}/init.d/snmpd ${D}${sysconfdir}/snmp/snmpd.conf
}
