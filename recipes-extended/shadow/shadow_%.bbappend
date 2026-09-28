# bcrypt ($2b$) for the passwords of the switch: harder to attack with GPUs
# than SHA-512 crypt, and checked by musl's own crypt(), which every program
# that checks a password uses (login, su, dropbear, lighttpd, clixon-switch).
# yescrypt would need libxcrypt instead of musl's crypt for all of them.
# shadow only writes bcrypt hashes when built with it; the method and its
# cost are set in /etc/login.defs by ethernet-switch-os-image-common.inc.
EXTRA_OECONF:append:class-target = " --with-bcrypt"
