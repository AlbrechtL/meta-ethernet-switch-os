# The firmware version, DISTRO_VERSION. Without it the version would be
# poky.conf's -- "Ethernet Switch OS 6.0.3" in the login banner is the Yocto
# release, which says nothing about the firmware and cannot be traced back to
# a commit.
#
# There is no release process yet (see docs/limitations.md in the
# ethernet-switch-os build repository), so the version is the git revision of
# this layer, which holds the distro configuration, every recipe and the
# images, behind a base version set by hand:
#
#   no tags (today)        0.0.0-3eae8394
#   after "git tag v0.1.0" 0.1.0
#   three commits later    0.1.0-3-g1a2b3c4d
#
# One "git describe" produces all three, so a real version number only takes a
# tag, no change here. The revision alone stays in ETHERNET_SWITCH_OS_GIT_REV,
# which os-release.bbappend writes as BUILD_ID: a clean tag would otherwise
# hide which commit a firmware was built from.
#
# A single revision cannot describe a build made from six repositories.
# image-buildinfo (inherited in ethernet-switch-os.conf) writes the branch and
# revision of every layer to /etc/buildinfo in each image.

# Output of a git command in this layer, or "" when git cannot run -- a
# checkout without .git (an exported tarball) must not fail the build.
def ethernet_switch_os_git(d, args):
    import bb.process

    path = d.getVar("ETHERNET_SWITCH_OS_LAYERDIR")
    if not path:
        return ""
    try:
        out, _ = bb.process.run("git " + args, cwd=path)
    except (bb.process.CmdError, OSError):
        return ""
    return out.strip()

def ethernet_switch_os_describe(d):
    describe = ethernet_switch_os_git(d, "describe --tags --always --dirty --abbrev=8")
    return describe or "unknown"

# The commit, never a tag. git describe carries the "-dirty" marker, rev-parse
# does not, so it is taken from the description computed above.
def ethernet_switch_os_revision(d):
    rev = ethernet_switch_os_git(d, "rev-parse --short=8 HEAD")
    if not rev:
        return "unknown"
    if d.getVar("ETHERNET_SWITCH_OS_GIT_DESCRIBE").endswith("-dirty"):
        rev += "-dirty"
    return rev

# "v1.2.3" and "v1.2.3-4-gabcd1234" are versions in themselves; anything else
# is a bare revision, which needs the base version in front of it.
def ethernet_switch_os_version(d):
    import re

    describe = d.getVar("ETHERNET_SWITCH_OS_GIT_DESCRIBE")
    if re.match(r"v\d", describe):
        return describe[1:]
    return "%s-%s" % (d.getVar("ETHERNET_SWITCH_OS_VERSION_BASE"), describe)

# Bumped by hand, and only until the first release tag: from then on the tag
# is the version.
ETHERNET_SWITCH_OS_VERSION_BASE ?= "0.0.0"

# Immediate, so that git runs once per build rather than once per expansion,
# and with vardepvalue so that a task signature depends on the revision itself
# and not on the code above (as metadata_scm.bbclass does for METADATA_REVISION).
ETHERNET_SWITCH_OS_GIT_DESCRIBE := "${@ethernet_switch_os_describe(d)}"
ETHERNET_SWITCH_OS_GIT_DESCRIBE[vardepvalue] = "${ETHERNET_SWITCH_OS_GIT_DESCRIBE}"
ETHERNET_SWITCH_OS_GIT_REV := "${@ethernet_switch_os_revision(d)}"
ETHERNET_SWITCH_OS_GIT_REV[vardepvalue] = "${ETHERNET_SWITCH_OS_GIT_REV}"

DISTRO_VERSION := "${@ethernet_switch_os_version(d)}"
DISTRO_VERSION[vardepvalue] = "${DISTRO_VERSION}"

# poky.conf's codename, "wrynose", is the Yocto release, not ours. It has to be
# removed rather than emptied: os-release.bb appends " (${DISTRO_CODENAME})" to
# VERSION whenever the variable merely exists.
unset DISTRO_CODENAME
