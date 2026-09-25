# Print a random joke when an interactive login shell starts (root). The cli
# user does not read /etc/profile.d; ethernet-switch-os-cli does the same for it.
case $- in
    *i*) [ -x /usr/bin/ethernet-switch-os-joke ] && /usr/bin/ethernet-switch-os-joke ;;
esac
