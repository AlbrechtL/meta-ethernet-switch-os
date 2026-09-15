SUMMARY = "CLIgen command-line interface generator"
DESCRIPTION = "Library that builds interactive CLIs from a syntax \
specification. Required by clixon."
HOMEPAGE = "https://github.com/clicon/cligen"
SECTION = "libs"
LICENSE = "Apache-2.0 | GPL-2.0-only"
LIC_FILES_CHKSUM = "file://LICENSE.md;md5=a26d10b563b3243304ad8ba36594ffdc"

SRC_URI = "git://github.com/clicon/cligen.git;protocol=https;branch=master"
SRCREV = "e43397cd5c951de85a22620122c02078a05babcd"

DEPENDS = "flex-native bison-native"

# Hand-written Makefile.in (no automake) that builds in the source tree.
inherit autotools-brokensep

# configure defaults INSTALLFLAGS to "-s", i.e. "install -s" with the host
# strip on target binaries. It only applies the default when the variable is
# unset, so an exported empty value leaves stripping to do_package.
export INSTALLFLAGS = ""

do_configure:prepend() {
    # scripts/version.sh derives the soname from "git describe" unless
    # .version exists; the fetched checkout has no tags to describe.
    echo "${PV}" > ${S}/.version
}
