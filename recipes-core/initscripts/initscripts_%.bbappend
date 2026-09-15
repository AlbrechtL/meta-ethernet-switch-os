FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# S = UNPACKDIR in initscripts, so the patch applies to the unpacked script.
SRC_URI += "file://0001-populate-volatile-create-TMP_FILE-when-there-are-no-.patch"
