# The firmware version as a file next to the images,
# ethernet-switch-os-version-${MACHINE}.txt. Published with them, so that a
# download says which build it is, and CI names its artifacts after it instead
# of repeating the version scheme (conf/distro/include/ethernet-switch-os-version.inc)
# in shell. Inherited by the ethernet-switch-os-swu-upgrade recipes, which every
# board builds once.
#
# nostamp, as in ethernet-switch-os-licenses.bbclass: the deploy directory is
# what is published, and a build that takes everything else from sstate must
# still leave the file there.

do_deploy_version() {
    install -d ${DEPLOY_DIR_IMAGE}
    echo "${DISTRO_VERSION}" > ${DEPLOY_DIR_IMAGE}/ethernet-switch-os-version-${MACHINE}.txt
}
do_deploy_version[nostamp] = "1"

addtask deploy_version before do_build
