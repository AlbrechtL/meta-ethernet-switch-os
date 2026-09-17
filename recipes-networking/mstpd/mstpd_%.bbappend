FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# 0001: MST region names of 32 characters, as 802.1Q allows (from upstream).
# 0002: MSTP for real. mstpd computes the port states of every MSTI but only
# passes the CIST's to the kernel. With it, mstpd programs the kernel's
# per-VLAN spanning tree (bridge mst_enable, Linux 5.18+): the VLAN-to-MSTI
# mapping and the port states of all MSTIs, which the rtl83xx DSA driver
# offloads to the switch chip.
SRC_URI += " \
    file://0001-configuration-Allow-settings-a-configuration-name-of.patch \
    file://0002-Program-per-VLAN-spanning-tree-into-the-kernel.patch \
"
