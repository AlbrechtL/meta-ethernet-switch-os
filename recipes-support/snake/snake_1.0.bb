SUMMARY = "Snake game for the terminal"
DESCRIPTION = "A small snake game for the serial console and SSH sessions. \
It uses termios and VT100 escape sequences instead of ncurses, so it links \
only libc, and redraws only the cells that change, which keeps it playable \
over a 115200 baud UART in minicom."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = "file://snake.c"

S = "${UNPACKDIR}"

do_configure[noexec] = "1"

do_compile() {
    ${CC} ${CFLAGS} ${LDFLAGS} -Os -o snake ${S}/snake.c
}

do_install() {
    install -d ${D}${bindir}
    install -m 0755 snake ${D}${bindir}/
}
