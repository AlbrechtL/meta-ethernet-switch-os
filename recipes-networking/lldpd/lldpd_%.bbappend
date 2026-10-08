# lldpd for LLDP, run by the clixon-switch backend plugin, which writes its
# configuration and changes it with lldpcli.
#
# LLDP only: no CDP, FDP, EDP, SONMP and no LLDP-MED. dot1 and dot3 add the
# VLAN, link aggregation and MAC/PHY TLVs. snmp: the LLDP-MIB AgentX
# subagent, against the trimmed net-snmp of recipes-networking/net-snmp; the
# plugin turns it on while snmpd runs.
PACKAGECONFIG = "dot1 dot3 snmp"

# The unprivileged process runs as nobody instead of a user of its own.
# Since the first-login setup creates the admin account, /etc/passwd and
# /etc/group live on the data partition, and a firmware update that brings a
# new system user would not have it there. The recipe's useradd stays (the
# class needs it); its lldpd user goes unused. lldpd lets the group use its
# control socket, so the plugin keeps the socket in a directory only root can
# enter.
EXTRA_OECONF:remove = "--with-privsep-user=lldpd --with-privsep-group=lldpd"
EXTRA_OECONF += "--with-privsep-user=nobody --with-privsep-group=nogroup"

# The plugin starts lldpd with its own configuration while /lldp enables it.
INITSCRIPT_PACKAGES = ""
CONFFILES:${PN} = ""
do_install:append() {
    rm -f ${D}${sysconfdir}/init.d/lldpd ${D}${sysconfdir}/default/lldpd \
        ${D}${sysconfdir}/lldpd.conf
    rm -rf ${D}${sysconfdir}/lldpd.d
}
