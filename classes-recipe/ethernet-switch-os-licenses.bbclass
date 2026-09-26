# The open-source licenses of a firmware, as one archive next to the .swu:
# ethernet-switch-os-licenses-${MACHINE}.tar.gz. Inherited by the
# ethernet-switch-os-swu-upgrade recipes, which every board builds once.
#
# Nothing new is collected here. license_image.bbclass already writes, per
# image, license.manifest (the packages in the root filesystem) and
# image_license.manifest (what is deployed next to it: kernel, bootloader);
# the texts are in each recipe's LICENSE_DIRECTORY entry. This copies the
# manifests and the texts of every recipe they name, like COPY_LIC_DIRS does
# into a root filesystem, plus the Rust crates linked into the clixon-switch
# plugin, which BitBake does not see (clixon-switch_git.bb).
#
# The same dependencies make the images' SBOMs, which the board files publish
# too: an initramfs image bundled into the kernel gets neither by itself.

# The images the firmware is made of. Everything in IMAGE_DEPENDS that is an
# image; set it where that is not so.
ETHERNET_SWITCH_OS_LICENSE_IMAGES ?= "${@' '.join(i for i in d.getVar('IMAGE_DEPENDS').split() if i != 'virtual/kernel')}"

# Recipes linked statically into something in the images, so in no manifest:
# the Rust standard library, in the clixon-switch plugin.
ETHERNET_SWITCH_OS_LICENSE_EXTRA_RECIPES ?= "libstd-rs"

python () {
    deps = ["clixon-switch:do_deploy"]
    for image in d.getVar("ETHERNET_SWITCH_OS_LICENSE_IMAGES").split():
        deps += ["%s:do_populate_lic_deploy" % image]
        if bb.data.inherits_class("create-spdx", d):
            deps += ["%s:do_create_image_sbom_spdx" % image]
    for recipe in d.getVar("ETHERNET_SWITCH_OS_LICENSE_EXTRA_RECIPES").split():
        deps += ["%s:do_populate_lic" % recipe]
    d.appendVarFlag("do_deploy_licenses", "depends", " " + " ".join(deps))
}

python do_deploy_licenses() {
    import glob, re, shutil

    licdir = d.getVar("LICENSE_DIRECTORY")
    pkgarchs = d.getVar("SSTATE_ARCHS").split()
    pkgarchs.reverse()
    machine = d.getVar("MACHINE")
    out = d.expand("${WORKDIR}/licenses-bundle")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(os.path.join(out, "manifests"))

    # do_populate_lic_deploy links the image's manifests under its
    # IMAGE_LINK_NAME: "<image>-<machine>.rootfs", or without ".rootfs" for
    # images that drop IMAGE_NAME_SUFFIX, such as an initramfs.
    recipes = set(d.getVar("ETHERNET_SWITCH_OS_LICENSE_EXTRA_RECIPES").split())
    for image in d.getVar("ETHERNET_SWITCH_OS_LICENSE_IMAGES").split():
        for name in ("%s-%s.rootfs" % (image, machine), "%s-%s" % (image, machine)):
            src = os.path.join(licdir, d.getVar("MACHINE_ARCH"), name)
            if os.path.isdir(src):
                break
        else:
            bb.fatal("no license manifests for image %s in %s" % (image, licdir))
        dst = os.path.join(out, "manifests", image)
        os.makedirs(dst)
        for f in glob.glob(os.path.join(src, "*.manifest")):
            shutil.copy(f, dst)
            with open(f) as m:
                recipes.update(re.findall(r"^RECIPE NAME: (\S+)$", m.read(), re.M))

    for recipe in sorted(recipes):
        for pkgarch in pkgarchs:
            src = os.path.join(licdir, pkgarch, recipe)
            if os.path.isdir(src):
                break
        else:
            bb.fatal("no license texts for recipe %s in %s" % (recipe, licdir))
        shutil.copytree(src, os.path.join(out, "licenses", recipe))

    crates = d.expand("${DEPLOY_DIR_IMAGE}/clixon-switch-crate-licenses-${MACHINE}.tar.gz")
    bb.process.run("tar -xzf %s -C %s" % (crates, os.path.join(out, "licenses")))
    os.rename(os.path.join(out, "licenses", "crate-licenses"),
              os.path.join(out, "licenses", "rust-crates"))

    with open(os.path.join(out, "README.txt"), "w") as f:
        f.write(d.expand("""\
Open-source licenses of ${DISTRO_NAME} for ${MACHINE}

manifests/<image>/license.manifest
    Every package in the image's root filesystem: its version, the recipe
    it is built from and its license.
manifests/<image>/image_license.manifest
    What is deployed next to the root filesystem, such as the kernel and the
    bootloader.
licenses/<recipe>/
    The license texts of each recipe named in the manifests: the files from
    its source (LIC_FILES_CHKSUM) and the generic_* texts of its licenses.
licenses/rust-crates/
    The Rust crates linked into the clixon-switch plugin, with
    crates.manifest listing their versions and licenses.

The sources of all of this are named in the SPDX SBOM published with the
firmware.
"""))

    deploydir = d.getVar("DEPLOY_DIR_IMAGE")
    bb.utils.mkdirhier(deploydir)
    bb.process.run(d.expand(
        "${ETHERNET_SWITCH_OS_LICENSES_TAR} -C ${WORKDIR} "
        "--transform='s,^licenses-bundle,licenses,' -cf - licenses-bundle "
        "| gzip -9n > ${DEPLOY_DIR_IMAGE}/ethernet-switch-os-licenses-${MACHINE}.tar.gz"))
}
do_deploy_licenses[vardepsexclude] = "SSTATE_ARCHS"
# Reads from the deploy directories other recipes write, so it has to run
# whenever the firmware is built, not come from sstate.
do_deploy_licenses[nostamp] = "1"

ETHERNET_SWITCH_OS_LICENSES_TAR = "tar --sort=name --owner=0 --group=0 --numeric-owner \
    --mtime=@${SOURCE_DATE_EPOCH} --format=gnu"

addtask deploy_licenses after do_swuimage before do_build
