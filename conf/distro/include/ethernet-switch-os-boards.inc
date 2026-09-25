# Per-board settings of the operating system, in one place. The hardware
# itself (device tree, flash layout, kernel) is described by the machine
# configuration in the BSP; this is what the OS layer needs to know on top.
#
#   ETHERNET_SWITCH_OS_LAN_PORTS    front ports of the factory default, as
#                                   labelled by SWITCH_PORT() in the device tree
#                                   (read by clixon-switch)
#   ETHERNET_SWITCH_OS_HWREVISION   /etc/hwrevision, "<board> <revision>"
#   ETHERNET_SWITCH_OS_HW_COMPAT    hardware-compatibility of the .swu files.
#                                   SWUpdate compares only the revision field
#                                   of /etc/hwrevision against it, so it has to
#                                   be unique per board: that is what makes a
#                                   board refuse another board's firmware.
#   ETHERNET_SWITCH_OS_BOARD_PACKAGES  extra packages for both images

# Zyxel GS1900-8 A1. Defaults, since switches in the field already carry
# "gs1900-8 a1" and must keep accepting upgrades.
ETHERNET_SWITCH_OS_LAN_PORTS ?= "lan1 lan2 lan3 lan4 lan5 lan6 lan7 lan8"
ETHERNET_SWITCH_OS_HWREVISION ?= "gs1900-8 a1"
ETHERNET_SWITCH_OS_HW_COMPAT ?= "a1"
ETHERNET_SWITCH_OS_BOARD_PACKAGES ?= ""

# Albrecht RTL8382MI test switch: 20 ports, DIP switches and a reset switch.
ETHERNET_SWITCH_OS_LAN_PORTS:albrecht-rtl8382mi-test = " \
    lan1 lan2 lan3 lan4 lan5 lan6 lan7 lan8 lan9 lan10 \
    lan11 lan12 lan13 lan14 lan15 lan16 lan17 lan18 lan19 lan20"
ETHERNET_SWITCH_OS_HWREVISION:albrecht-rtl8382mi-test = "albrecht-rtl8382mi-test rtl8382mi-test-1"
ETHERNET_SWITCH_OS_HW_COMPAT:albrecht-rtl8382mi-test = "rtl8382mi-test-1"
ETHERNET_SWITCH_OS_BOARD_PACKAGES:albrecht-rtl8382mi-test = "ethernet-switch-os-buttons"

# 4-port managed switch HAT on a Raspberry Pi (meta-rpi-managed-switch-bsp).
# The ports are the same on every Pi; the firmware is not, so the revision
# names the Pi model.
ETHERNET_SWITCH_OS_LAN_PORTS:rpi-managed-switch = "lan1 lan2 lan3 lan4"
ETHERNET_SWITCH_OS_HWREVISION:rpi-managed-switch-rpi0 = "rpi-managed-switch-4-port rpi-managed-switch-4-port-rpi0"
ETHERNET_SWITCH_OS_HW_COMPAT:rpi-managed-switch-rpi0 = "rpi-managed-switch-4-port-rpi0"
