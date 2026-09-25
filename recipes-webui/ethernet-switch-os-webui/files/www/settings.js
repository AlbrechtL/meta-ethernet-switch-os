// Edit dialogs. Each one writes the running configuration over RESTCONF in
// as few requests as possible, so the backend validates the change as one
// commit and either takes it whole or answers why not. Nothing is saved to
// startup here: a reboot undoes a change that locked the page out.

"use strict";

const TYPES = "openconfig-spanning-tree-types";
const IFACE = (name) => `data/openconfig-interfaces:interfaces/interface=${encodeURIComponent(name)}`;

// ---------------------------------------------------------------------------
// Form helpers

function field(label, control, hint) {
  return el("label", { class: "field" }, el("span", {}, label), control, hint ? el("small", { class: "muted" }, hint) : null);
}

function input(name, value, attrs = {}) {
  return el("input", { name, value: value ?? "", ...attrs });
}

function select(name, options, selected) {
  return el(
    "select",
    { name },
    options.map(([value, label]) =>
      el("option", { value, selected: String(value) === String(selected ?? "") }, label),
    ),
  );
}

function checkbox(name, checked, label) {
  return el("label", { class: "check" }, el("input", { type: "checkbox", name, checked: !!checked }), label);
}

const note = (text, warn = false) => el("p", { class: warn ? "note warn" : "note" }, text);

// Listeners on the (reused) form for the open dialog only.
let dialogScope = new AbortController();

// Shows form parts only while `when()` holds, checked once the dialog is
// built and on every change.
function showWhen(form, node, when) {
  form.addEventListener("change", () => (node.hidden = !when()), { signal: dialogScope.signal });
  return node;
}

// Opens the dialog. `apply(form)` does the requests; the dialog stays open
// with the error when it throws, and closes and refreshes when it returns.
// It returns false for a change that needs no Save.
function openDialog(title, build, apply, { applyLabel = "Apply" } = {}) {
  const dialog = $("dialog");
  const form = $("dialog-form");
  const error = $("dialog-error");
  const button = $("dialog-apply");
  $("dialog-title").textContent = title;
  button.textContent = applyLabel;
  error.hidden = true;
  dialogScope.abort();
  dialogScope = new AbortController();
  const body = el("div", { id: "dialog-body" });
  $("dialog-body").replaceWith(body);
  body.append(...build(form));
  form.dispatchEvent(new Event("change"));
  form.onsubmit = async (event) => {
    event.preventDefault();
    button.disabled = true;
    error.hidden = true;
    try {
      const changed = await apply(form.elements);
      dialog.close();
      if (changed !== false) setUnsaved(true);
      refresh();
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
  dialog.showModal();
}

// The dialog's own checks, shown like the switch's errors.
function fail(message) {
  throw new Error(message);
}

// clixon refuses an empty list ("Mandatory key in 'list user'"): drops
// empty lists, and the containers that leaves empty, below `node`.
function prune(node) {
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) value.forEach((v) => v && typeof v === "object" && prune(v));
    else if (value && typeof value === "object") prune(value);
    const empty = Array.isArray(value) ? value.length === 0 : value && typeof value === "object" && Object.keys(value).length === 0;
    if (empty) delete node[key];
  }
  return node;
}

// Reads `path` as configuration only, lets `mutate` change it, and PUTs it
// back: one commit, and leaves or entries removed from the tree are
// removed from the switch. `key` names the top-level member for the PUT.
async function modify(path, key, mutate) {
  let value = {};
  try {
    value = Object.values(await restconf("GET", `${path}?content=config`))[0] ?? {};
  } catch (error) {
    if (!missing(error)) throw error;
  }
  mutate(value);
  await restconf("PUT", path, { [key]: prune(value) });
}

// "10, 20-30, 40..50" → [10, "20..30", "40..50"], openconfig's trunk-vlans.
function parseVlanList(text) {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((part) => {
      const range = part.match(/^(\d+)\s*(?:-|\.\.)\s*(\d+)$/);
      if (range) return `${Number(range[1])}..${Number(range[2])}`;
      if (/^\d+$/.test(part)) return Number(part);
      fail(`"${part}" is not a VLAN or a range like 20-30`);
    });
}

function vlanOptions() {
  return current.vlans.map((v) => {
    const name = v.config?.name ?? v.state?.name;
    return [v["vlan-id"], name ? `${v["vlan-id"]} (${name})` : String(v["vlan-id"])];
  });
}

// ---------------------------------------------------------------------------
// System

function editSystem() {
  const s = current.system?.config ?? current.system?.state ?? {};
  openDialog(
    "System",
    () => [
      field("Contact", input("contact", s.contact, { maxlength: 255 }), "Who is responsible for the switch. SNMP's sysContact."),
      field("Location", input("location", s.location, { maxlength: 255 }), "Where the switch is. SNMP's sysLocation."),
      note("The host name is not configurable."),
    ],
    async (f) => {
      const config = {};
      if (f.contact.value.trim()) config.contact = f.contact.value.trim();
      if (f.location.value.trim()) config.location = f.location.value.trim();
      await restconf("PUT", "data/clixon-switch:system/config", { "clixon-switch:config": config });
    },
  );
}

// ---------------------------------------------------------------------------
// Ports

function editPort(name) {
  const port = ports().find((p) => p.name === name);
  if (!port) return;
  const dot1q = current.mode === "DOT1Q";
  const vlan = port["openconfig-if-ethernet:ethernet"]?.["openconfig-vlan:switched-vlan"]?.config ?? {};
  openDialog(
    `Port ${name}`,
    (form) => {
      const parts = [
        checkbox("enabled", port.config?.enabled ?? true, "Enabled"),
        field("Description", input("description", port.config?.description, { maxlength: 255 })),
      ];
      if (!dot1q) {
        const group = groupOf(name);
        parts.push(note(`Port-based mode: the port is in ${group ? `group ${group.id}` : "no group"}. Change that under Port-based VLAN groups.`));
        return parts;
      }
      const isTrunk = () => form.elements.mode.value === "TRUNK";
      parts.push(
        field("VLAN mode", select("mode", [["ACCESS", "Access: untagged in one VLAN"], ["TRUNK", "Trunk: tagged VLANs"]], vlan["interface-mode"] ?? "ACCESS")),
        showWhen(form, field("Access VLAN", select("access", vlanOptions(), vlan["access-vlan"] ?? 1)), () => !isTrunk()),
        showWhen(
          form,
          el(
            "div",
            {},
            field("Native VLAN", select("native", [["", "none: untagged frames are dropped"], ...vlanOptions()], vlan["native-vlan"])),
            field("Tagged VLANs", input("trunk", list(vlan["trunk-vlans"]).join(", "), { placeholder: "10, 20-30" }), "Empty: all declared VLANs."),
          ),
          isTrunk,
        ),
      );
      parts.push(note("Moving the port you are connected through to another VLAN can cut you off. A reboot undoes unsaved changes.", true));
      return parts;
    },
    async (f) => {
      const config = { name, type: port.config?.type ?? "iana-if-type:ethernetCsmacd", enabled: f.enabled.checked };
      if (f.description.value.trim()) config.description = f.description.value.trim();
      const entry = { name, config };
      if (dot1q) {
        const switched = { "interface-mode": f.mode.value };
        if (f.mode.value === "ACCESS") {
          switched["access-vlan"] = Number(f.access.value);
        } else {
          if (f.native.value) switched["native-vlan"] = Number(f.native.value);
          const trunk = parseVlanList(f.trunk.value);
          if (trunk.length) switched["trunk-vlans"] = trunk;
        }
        entry["openconfig-if-ethernet:ethernet"] = { "openconfig-vlan:switched-vlan": { config: switched } };
      }
      // PUT, not PATCH: a PATCH merges leaf-lists, so trunk VLANs could
      // only ever be added.
      await restconf("PUT", IFACE(name), { "openconfig-interfaces:interface": [entry] });
    },
  );
}

// ---------------------------------------------------------------------------
// VLANs (802.1Q). clixon writes list keys as strings ("vlan-id": "1") and
// the same leaf in config as a number: VLAN and group ids are compared as
// numbers.

function editVlan(id) {
  const vlan = current.vlans.find((v) => Number(v["vlan-id"]) === id);
  const config = vlan?.config ?? vlan?.state ?? {};
  openDialog(
    vlan ? `VLAN ${id}` : "Add VLAN",
    () => [
      vlan ? null : field("VLAN ID", input("id", "", { type: "number", min: 1, max: 4094, required: true })),
      field("Name", input("name", config.name, { maxlength: 32 })),
      field("Status", select("status", [["ACTIVE", "Active"], ["SUSPENDED", "Suspended: carried by no port"]], config.status ?? "ACTIVE")),
      vlan ? null : note("Add the VLAN to ports in their Edit dialog afterwards."),
    ].filter(Boolean),
    async (f) => {
      const vlanId = vlan ? id : Number(f.id.value);
      if (!vlan && current.vlans.some((v) => Number(v["vlan-id"]) === vlanId)) fail(`VLAN ${vlanId} exists already.`);
      const c = { "vlan-id": vlanId, status: f.status.value };
      if (f.name.value.trim()) c.name = f.name.value.trim();
      await restconf("PUT", `data/clixon-switch:vlans/vlan=${vlanId}`, {
        "clixon-switch:vlan": [{ "vlan-id": vlanId, config: c }],
      });
    },
  );
}

function deleteVlan(id) {
  openDialog(
    `Delete VLAN ${id}?`,
    () => [note("Ports and routed VLAN interfaces that still use it make the switch refuse this. Change them first.")],
    () => restconf("DELETE", `data/clixon-switch:vlans/vlan=${id}`),
    { applyLabel: "Delete" },
  );
}

// ---------------------------------------------------------------------------
// Port-based VLAN groups

function editGroup(id) {
  const group = current.groups.find((g) => Number(g.id) === id);
  const config = group?.config ?? group?.state ?? {};
  const members = list(config.port);
  openDialog(
    group ? `Group ${id}` : "Add group",
    () => [
      group ? null : field("Group ID", input("id", "", { type: "number", min: 1, max: 4094, required: true })),
      field("Name", input("name", config.name, { maxlength: 32 })),
      el(
        "fieldset",
        {},
        el("legend", {}, "Ports"),
        ports().map((p) => {
          const other = groupOf(p.name);
          const moving = other && Number(other.id) !== id ? ` (moves from group ${other.id})` : "";
          return checkbox(`port:${p.name}`, members.includes(p.name), `${p.name}${moving}`);
        }),
      ),
      note("A port is in exactly one group. Ports that end up in no group make the switch refuse the change.", true),
    ].filter(Boolean),
    async (f) => {
      const groupId = group ? id : Number(f.id.value);
      if (!group && current.groups.some((g) => Number(g.id) === groupId)) fail(`Group ${groupId} exists already.`);
      const chosen = ports().map((p) => p.name).filter((n) => f[`port:${n}`].checked);
      // One PUT of all groups: moving a port out of its old group has to
      // happen in the same commit.
      await modify("data/clixon-switch:port-based-vlans", "clixon-switch:port-based-vlans", (tree) => {
        const groups = list(tree.group).filter((g) => Number(g.id) !== groupId);
        for (const g of groups) {
          if (g.config) g.config.port = list(g.config.port).filter((p) => !chosen.includes(p));
        }
        const c = { id: groupId, port: chosen };
        if (f.name.value.trim()) c.name = f.name.value.trim();
        groups.push({ id: groupId, config: c });
        tree.group = groups;
      });
    },
  );
}

function deleteGroup(id) {
  openDialog(
    `Delete group ${id}?`,
    () => [note("Its ports must be moved to another group first, or the switch refuses this.")],
    () => restconf("DELETE", `data/clixon-switch:port-based-vlans/group=${id}`),
    { applyLabel: "Delete" },
  );
}

// ---------------------------------------------------------------------------
// VLAN mode

// Switching mode replaces the VLAN configuration of both modes and of
// every port, which only a PUT of the whole datastore does in one commit.
function editVlanMode() {
  const to = current.mode === "DOT1Q" ? "PORT_BASED" : "DOT1Q";
  const names = ports().map((p) => p.name);
  openDialog(
    to === "PORT_BASED" ? "Switch to port-based VLANs?" : "Switch to 802.1Q VLANs?",
    () => [
      note(
        to === "PORT_BASED"
          ? "All VLANs and the VLAN settings of every port are removed. All ports go into group 1, which routed VLAN interfaces on VLAN 1 keep using."
          : "All groups are removed. VLAN 1 is declared and every port becomes an access port in it, which routed VLAN interfaces on group 1 keep using.",
      ),
      note("Routed VLAN interfaces on another VLAN or group make the switch refuse this.", true),
    ],
    async () => {
      const body = await restconf("GET", "data?content=config");
      const data = Object.values(body)[0] ?? {};
      const interfaces = list(data["openconfig-interfaces:interfaces"]?.interface);
      data["clixon-switch:switch"] = { config: { "vlan-mode": to } };
      if (to === "PORT_BASED") {
        delete data["clixon-switch:vlans"];
        data["clixon-switch:port-based-vlans"] = { group: [{ id: 1, config: { id: 1, name: "default", port: names } }] };
        for (const i of interfaces) {
          const ethernet = i["openconfig-if-ethernet:ethernet"];
          if (!ethernet) continue;
          delete ethernet["openconfig-vlan:switched-vlan"];
          if (Object.keys(ethernet).length === 0) delete i["openconfig-if-ethernet:ethernet"];
        }
      } else {
        delete data["clixon-switch:port-based-vlans"];
        data["clixon-switch:vlans"] = { vlan: [{ "vlan-id": 1, config: { "vlan-id": 1, name: "default" } }] };
        for (const i of interfaces) {
          if (!names.includes(i.name)) continue;
          const ethernet = (i["openconfig-if-ethernet:ethernet"] ??= {});
          ethernet["openconfig-vlan:switched-vlan"] = { config: { "interface-mode": "ACCESS", "access-vlan": 1 } };
        }
      }
      await restconf("PUT", "data", { "ietf-restconf:data": data });
    },
    { applyLabel: "Switch" },
  );
}

// ---------------------------------------------------------------------------
// Management address

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function editSvi(name) {
  const svi = current.interfaces.find((i) => i.name === name);
  const ipv4 = svi?.["openconfig-vlan:routed-vlan"]?.["openconfig-if-ip:ipv4"] ?? {};
  // Static addresses are configuration; DHCP's are state only.
  const statics = list(ipv4.addresses?.address)
    .filter((a) => a.config)
    .map((a) => `${a.ip}/${a.config["prefix-length"]}`);
  const dhcp = ipv4.config?.["dhcp-client"] ?? false;
  openDialog(
    `Management address: ${name}`,
    () => [
      checkbox("dhcp", dhcp, "DHCP client"),
      field("Static IPv4 addresses", el("textarea", { name: "addresses", rows: 3, placeholder: "192.168.1.1/24" }, statics.join("\n")), "One address/prefix length per line."),
      note(`This page is loaded from ${location.hostname}. Removing that address cuts it off; open the new address then. A reboot undoes unsaved changes.`, true),
    ],
    async (f) => {
      const addresses = f.addresses.value
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((text) => {
          const [ip, prefix, extra] = text.split("/");
          const length = Number(prefix);
          if (!IPV4.test(ip) || extra !== undefined || !/^\d+$/.test(prefix ?? "") || length > 32) {
            fail(`"${text}" is not an IPv4 address with prefix length, like 192.168.1.1/24`);
          }
          return { ip, config: { ip, "prefix-length": length } };
        });
      if (!addresses.length && !f.dhcp.checked) fail("Without a static address or DHCP the switch cannot be managed over IP.");
      const body = { config: { "dhcp-client": f.dhcp.checked } };
      if (addresses.length) body.addresses = { address: addresses };

      const hostKept = !IPV4.test(location.hostname) || addresses.some((a) => a.ip === location.hostname);
      if (!hostKept && !confirm(`${location.hostname} is removed, and this page loses the switch. Continue?`)) {
        fail("Cancelled.");
      }
      try {
        await restconf("PUT", `${IFACE(name)}/openconfig-vlan:routed-vlan/openconfig-if-ip:ipv4`, { "openconfig-if-ip:ipv4": body });
      } catch (error) {
        // The answer to the commit that removed our address never arrives;
        // a refusal does.
        if (hostKept || error instanceof RestconfError) throw error;
      }
      if (!hostKept) {
        setUnsaved(true);
        const next = addresses[0]?.ip;
        $("error").replaceChildren(
          "The address this page used is gone. ",
          next ? el("a", { href: `http://${next}/` }, `Open http://${next}/`) : "Find the switch's DHCP address in your DHCP server.",
          " and save the configuration there, or reboot the switch to undo the change.",
        );
        $("error").hidden = false;
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Spanning tree

const STP_PROTOCOLS = [
  ["", "Off"],
  ["clixon-switch:STP", "STP (802.1D)"],
  [`${TYPES}:RSTP`, "RSTP (802.1w)"],
  [`${TYPES}:MSTP`, "MSTP (802.1s)"],
];

const priorities = (step, max) =>
  Array.from({ length: max / step + 1 }, (_, i) => [i * step, String(i * step)]);

// The configured protocol, as an option value of STP_PROTOCOLS.
function stpProtocol() {
  const configured = unprefixed(list(current.stp?.global?.config?.["enabled-protocol"])[0]);
  return STP_PROTOCOLS.find(([value]) => value && unprefixed(value) === configured)?.[0] ?? "";
}

function editStp() {
  const protocol = stpProtocol();
  const mstp = protocol.endsWith(":MSTP");
  const config = (mstp ? current.stp?.mstp?.config : current.stp?.rstp?.config) ?? {};
  const priority = config["bridge-priority"] ?? config["clixon-switch:bridge-priority"] ?? 32768;
  openDialog(
    "Spanning tree",
    (form) => [
      field("Protocol", select("protocol", STP_PROTOCOLS, protocol)),
      showWhen(
        form,
        el(
          "div",
          {},
          field("Bridge priority", select("priority", priorities(4096, 61440), priority), "Lowest wins the root bridge election."),
          el(
            "div",
            { class: "row" },
            field("Hello time (s)", input("hello", config["hello-time"] ?? 2, { type: "number", min: 1, max: 10, required: true })),
            field("Max age (s)", input("maxAge", config["max-age"] ?? 20, { type: "number", min: 6, max: 40, required: true })),
            field("Forward delay (s)", input("delay", config["forwarding-delay"] ?? 15, { type: "number", min: 4, max: 30, required: true })),
          ),
          note("Turning spanning tree on or changing the protocol blocks the ports until they are known to be loop-free: a few seconds with RSTP, about 30 seconds with STP. This page may lose the switch meanwhile.", true),
          note("MSTP regions and instances are configured with the CLI or RESTCONF."),
        ),
        () => form.elements.protocol.value !== "",
      ),
    ],
    async (f) => {
      await modify("data/openconfig-spanning-tree:stp", "openconfig-spanning-tree:stp", (stp) => {
        const global = ((stp.global ??= {}).config ??= {});
        if (!f.protocol.value) {
          delete global["enabled-protocol"];
          return;
        }
        global["enabled-protocol"] = [f.protocol.value];
        const isMstp = f.protocol.value.endsWith(":MSTP");
        const tree = isMstp ? ((stp.mstp ??= {}).config ??= {}) : ((stp.rstp ??= {}).config ??= {});
        tree[isMstp ? "clixon-switch:bridge-priority" : "bridge-priority"] = Number(f.priority.value);
        tree["hello-time"] = Number(f.hello.value);
        tree["max-age"] = Number(f.maxAge.value);
        tree["forwarding-delay"] = Number(f.delay.value);
      });
    },
  );
}

// Finds or adds the entry for `name` in an openconfig interface list.
function entryFor(container, name) {
  const entries = (container.interface = list(container.interface));
  let entry = entries.find((i) => i.name === name);
  if (!entry) entries.push((entry = { name, config: { name } }));
  entry.config ??= { name };
  return entry.config;
}

function editStpPort(name) {
  const stp = current.stp;
  const mstp = stpProtocol().endsWith(":MSTP");
  const treePorts = mstp ? stp?.mstp?.["clixon-switch:interfaces"] : stp?.rstp?.interfaces;
  const tree = list(treePorts?.interface).find((i) => i.name === name)?.config ?? {};
  const feature = list(stp?.interfaces?.interface).find((i) => i.name === name)?.config ?? {};
  openDialog(
    `Spanning tree: ${name}`,
    () => [
      field(
        "Edge port",
        select("edge", [["", "Auto: detected"], [`${TYPES}:EDGE_ENABLE`, "Yes: an end device, forwards at once"], [`${TYPES}:EDGE_DISABLE`, "No"]],
          feature["edge-port"] ? `${TYPES}:${unprefixed(feature["edge-port"])}` : ""),
      ),
      field("Link type", select("link", [["", "Auto"], ["P2P", "Point-to-point"], ["SHARED", "Shared"]], feature["link-type"])),
      field("Path cost", input("cost", tree.cost, { type: "number", min: 1, max: 200000000, placeholder: "auto" }), "Empty: from the link speed."),
      field("Port priority", select("priority", priorities(16, 240), tree["port-priority"] ?? 128)),
      note(mstp ? "Cost and priority apply to the common spanning tree (CIST)." : "Without a protocol, these take effect once spanning tree is on."),
    ],
    async (f) => {
      await modify("data/openconfig-spanning-tree:stp", "openconfig-spanning-tree:stp", (s) => {
        const features = entryFor((s.interfaces ??= {}), name);
        if (f.edge.value) features["edge-port"] = f.edge.value;
        else delete features["edge-port"];
        if (f.link.value) features["link-type"] = f.link.value;
        else delete features["link-type"];

        const parent = mstp ? (s.mstp ??= {}) : (s.rstp ??= {});
        const key = mstp ? "clixon-switch:interfaces" : "interfaces";
        const port = entryFor((parent[key] ??= {}), name);
        if (f.cost.value) port.cost = Number(f.cost.value);
        else delete port.cost;
        port["port-priority"] = Number(f.priority.value);
      });
    },
  );
}

// ---------------------------------------------------------------------------
// SNMP

// Members of this group may read everything, authenticated and encrypted.
const SNMP_GROUP = "readers";
const SNMP_VIEW = "all";

// The engine ID keys are made for: the configured one, else the one the
// running agent derived from the MAC address. Neither exists before SNMP
// first runs; then a new one is set, as the user guide recommends anyway.
function snmpEngineId() {
  const engine = current.snmp?.engine ?? {};
  return engine["engine-id"] ?? engine["clixon-switch:engine-id-in-use"] ?? null;
}

function newEngineId() {
  // 80:00:1f:88 is net-snmp's enterprise number, 04 says text follows.
  const name = new TextEncoder().encode(current.system?.state?.hostname || "switch").subarray(0, 27);
  return colonHex([0x80, 0x00, 0x1f, 0x88, 0x04, ...name]);
}

function editSnmpUser() {
  const engineId = snmpEngineId();
  const enabled = current.snmp?.engine?.enabled ?? false;
  const passphrase = (name) => input(name, "", { type: "password", minlength: 8, required: true, autocomplete: "new-password" });
  openDialog(
    "Add SNMP user",
    () => [
      field("User name", input("name", "", { maxlength: 32, required: true, pattern: "[A-Za-z0-9._\\-]+" })),
      field("Authentication passphrase (SHA)", passphrase("auth"), "At least 8 characters."),
      field("Encryption passphrase (AES)", passphrase("priv"), "At least 8 characters."),
      engineId
        ? null
        : field("Engine ID", input("engine", newEngineId(), { required: true, pattern: "([0-9a-fA-F]{2}:){4,31}[0-9a-fA-F]{2}" }), "Keys belong to this engine ID. Give every switch its own."),
      enabled ? null : checkbox("enable", true, "Turn the SNMP agent on"),
      note(`The passphrases stay in this browser; the switch only gets keys made from them. The user can read everything with authPriv (group "${SNMP_GROUP}").`),
    ].filter(Boolean),
    async (f) => {
      const name = f.name.value.trim();
      if (list(current.snmp?.usm?.local?.user).some((u) => u.name === name)) fail(`User ${name} exists already.`);
      const engineIdUsed = engineId ?? f.engine.value.toLowerCase();
      const user = {
        name,
        auth: { sha: { key: localizeKey(f.auth.value, engineIdUsed) } },
        priv: { aes: { key: localizeKey(f.priv.value, engineIdUsed, 16) } },
      };
      await modify("data/ietf-snmp:snmp", "ietf-snmp:snmp", (snmp) => {
        const engine = (snmp.engine ??= {});
        if (!engineId) engine["engine-id"] = engineIdUsed;
        if (f.enable?.checked) engine.enabled = true;
        engine.version = { ...engine.version, v3: [null] };
        if (list(engine.listen).length === 0) engine.listen = [{ name: "all", udp: { ip: "0.0.0.0" } }];

        const local = ((snmp.usm ??= {}).local ??= {});
        local.user = [...list(local.user), user];

        const vacm = (snmp.vacm ??= {});
        vacm.group = list(vacm.group);
        let group = vacm.group.find((g) => g.name === SNMP_GROUP);
        if (!group) {
          group = {
            name: SNMP_GROUP,
            member: [],
            access: [{ context: "", "security-model": "usm", "security-level": "auth-priv", "read-view": SNMP_VIEW }],
          };
          vacm.group.push(group);
        }
        group.member = [...list(group.member), { "security-name": name, "security-model": ["usm"] }];
        vacm.view = list(vacm.view);
        if (!vacm.view.some((v) => v.name === SNMP_VIEW)) vacm.view.push({ name: SNMP_VIEW, include: ["1.3.6.1"] });
      });
    },
  );
}

function deleteSnmpUser(name) {
  const users = list(current.snmp?.usm?.local?.user);
  const last = users.length === 1 && current.snmp?.engine?.enabled;
  openDialog(
    `Delete SNMP user ${name}?`,
    () => [last ? note("This is the last user, so the SNMP agent is turned off as well.", true) : null].filter(Boolean),
    () =>
      modify("data/ietf-snmp:snmp", "ietf-snmp:snmp", (snmp) => {
        const local = snmp.usm?.local;
        if (local) local.user = list(local.user).filter((u) => u.name !== name);
        for (const g of list(snmp.vacm?.group)) {
          g.member = list(g.member).filter((m) => m["security-name"] !== name);
        }
        if (!list(local?.user).length && snmp.engine) snmp.engine.enabled = false;
      }),
    { applyLabel: "Delete" },
  );
}

function toggleSnmp() {
  const enabled = current.snmp?.engine?.enabled ?? false;
  if (!enabled && !list(current.snmp?.usm?.local?.user).length) {
    editSnmpUser();
    return;
  }
  openDialog(
    enabled ? "Turn SNMP off?" : "Turn SNMP on?",
    () => [note(enabled ? "Users and keys are kept." : "The agent answers SNMPv3 on UDP port 161.")],
    () =>
      modify("data/ietf-snmp:snmp", "ietf-snmp:snmp", (snmp) => {
        (snmp.engine ??= {}).enabled = !enabled;
      }),
    { applyLabel: enabled ? "Turn off" : "Turn on" },
  );
}
