// Switch status page. Everything comes from RESTCONF on the same origin
// (clixon_restconf serves this file too). The edit dialogs are in
// settings.js; they change the running configuration, and "Save" copies it
// to startup.

"use strict";

const RESTCONF = "/restconf/";
const REFRESH_MS = 5000;
// A commit that moves the management address never gets its answer through.
const TIMEOUT_MS = 15000;
// swupdate's web server on the same host. Plain HTTP: swupdate is built
// without TLS.
const UPDATE_PORT = 8080;

class RestconfError extends Error {
  constructor(status, body) {
    const errors = [].concat(body?.["ietf-restconf:errors"]?.error ?? []);
    const messages = errors.map((e) => e["error-message"]).filter(Boolean);
    super(messages.length ? messages.join("; ") : `HTTP ${status}`);
    this.status = status;
    this.tag = errors[0]?.["error-tag"];
  }
}

// A RESTCONF request below /restconf/ ("data/...", "operations/..."), with
// an RFC 7951 JSON body. Returns the parsed answer, {} when it is empty.
async function restconf(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = { Accept: "application/yang-data+json" };
  if (body !== undefined) headers["Content-Type"] = "application/yang-data+json";
  let response, text;
  try {
    response = await fetch(RESTCONF + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    throw new Error(
      error.name === "AbortError"
        ? "The switch did not answer in time. A change may have been applied anyway: the page shows the switch's state once it answers again."
        : "The switch cannot be reached.",
    );
  } finally {
    clearTimeout(timer);
  }
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Not JSON: keep the HTTP status as the message.
  }
  if (!response.ok) throw new RestconfError(response.status, json);
  return json;
}

// clixon answers a resource that does not exist with one of these.
const missing = (error) => error.status === 404 || error.tag === "invalid-value";

// GET a RESTCONF data resource: the value of its single top-level member.
// With optional, a resource that does not exist is null.
async function restconfGet(path, { optional = false } = {}) {
  try {
    return Object.values(await restconf("GET", "data/" + path))[0] ?? null;
  } catch (error) {
    if (optional && missing(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// DOM helpers. Data is only ever inserted as text.

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined) {
      node.append(child instanceof Node ? child : String(child));
    }
  }
  return node;
}

function facts(entries) {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .flatMap(([label, value]) => [el("dt", {}, label), el("dd", {}, value)]);
}

function badge(status) {
  const text = status ?? "UNKNOWN";
  return el("span", { class: text === "UP" ? "badge up" : "badge" }, text);
}

// A small button that opens an edit dialog.
const action = (label, onclick) => el("button", { type: "button", class: "small", onclick }, label);

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Formatting

function duration(seconds) {
  if (seconds === undefined) return null;
  let s = Number(seconds);
  const days = Math.floor(s / 86400);
  s %= 86400;
  const parts = [];
  if (days) parts.push(`${days} d`);
  parts.push(`${Math.floor(s / 3600)} h`, `${Math.floor((s % 3600) / 60)} min`);
  return parts.join(" ");
}

function bytes(value) {
  if (value === undefined) return "";
  let n = Number(value);
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return i === 0 ? `${n} B` : `${n.toFixed(1)} ${units[i]}`;
}

function datetime(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date) ? value : date.toLocaleString();
}

const list = (value) => [].concat(value ?? []);

// "openconfig-spanning-tree-types:RSTP" → "RSTP".
const unprefixed = (value) => (value === undefined ? undefined : String(value).replace(/^.*:/, ""));

// ---------------------------------------------------------------------------
// What the last refresh read, for the edit dialogs to start from.

const current = {
  system: {},
  interfaces: [],
  mode: "DOT1Q",
  vlans: [],
  groups: [],
  stp: null,
  snmp: null,
};

const ports = () => current.interfaces.filter((i) => i["openconfig-if-ethernet:ethernet"]);

// ---------------------------------------------------------------------------
// Rendering

function renderSystem(system) {
  const s = system?.state ?? {};
  const firmware = [s["os-name"], s["os-version"]].filter(Boolean).join(" ");
  $("hostname").textContent = s.hostname || "Switch";
  $("firmware").textContent = firmware;
  document.title = `${s.hostname || "Switch"} – status`;

  let memory = null;
  if (s["memory-total"] && s["memory-available"]) {
    const total = Number(s["memory-total"]);
    const used = total - Number(s["memory-available"]);
    const percent = Math.round((used / total) * 100);
    memory = el(
      "div",
      {},
      `${bytes(used * 1024)} of ${bytes(total * 1024)} used (${percent} %)`,
      el("div", { class: "meter" }, el("span", { style: `width:${percent}%` })),
    );
  }
  const load = ["1", "5", "15"].map((m) => s[`load-average-${m}`]);
  $("system").replaceChildren(
    ...facts([
      ["Host name", s.hostname],
      ["Firmware", firmware],
      ["Kernel", s["kernel-release"]],
      ["Uptime", duration(s.uptime)],
      ["Switch clock", datetime(s["current-datetime"])],
      ["Load", load.every((l) => l !== undefined) ? load.join(" / ") : null],
      ["Memory", memory],
      ["Contact", s.contact],
      ["Location", s.location],
    ]),
  );
}

function renderManagement(interfaces) {
  const svis = interfaces.filter((i) => i["openconfig-vlan:routed-vlan"]);
  if (svis.length === 0) {
    $("management").replaceChildren(el("p", { class: "muted" }, "No routed VLAN interface."));
    return;
  }
  $("management").replaceChildren(
    ...svis.map((svi) => {
      const routed = svi["openconfig-vlan:routed-vlan"];
      const ipv4 = routed["openconfig-if-ip:ipv4"] ?? {};
      const addresses = list(ipv4.addresses?.address).map((a) => {
        const state = a.state ?? a.config ?? {};
        const origin = state.origin ? ` (${state.origin.toLowerCase()})` : "";
        return `${a.ip}/${state["prefix-length"]}${origin}`;
      });
      const lease = ipv4.state?.["clixon-switch:dhcp-lease"];
      const dhcp = ipv4.state?.["dhcp-client"] ?? ipv4.config?.["dhcp-client"];
      return el(
        "div",
        { class: "svi" },
        el("h3", {}, svi.name, badge(svi.state?.["oper-status"]), action("Edit", () => editSvi(svi.name))),
        el(
          "dl",
          { class: "facts" },
          facts([
            ["VLAN", routed.config?.vlan],
            ["IPv4", addresses.length ? addresses.join(", ") : "none"],
            ["DHCP client", dhcp ? (lease ? "bound" : "waiting for a lease") : "off"],
            ["Gateway", list(lease?.router)[0]],
            ["DNS", list(lease?.["dns-server"]).join(", ")],
            ["Domain", lease?.domain],
            ["Lease expires in", duration(lease?.["remaining-time"])],
          ]),
        ),
      );
    }),
  );
}

function groupOf(portName) {
  return current.groups.find((g) => list(g.config?.port ?? g.state?.port).includes(portName));
}

function portVlan(port, mode) {
  if (mode === "PORT_BASED") {
    const group = groupOf(port.name);
    if (!group) return "–";
    const name = group.config?.name ?? group.state?.name;
    return `group ${group.id}${name ? ` (${name})` : ""}`;
  }
  const config =
    port["openconfig-if-ethernet:ethernet"]?.["openconfig-vlan:switched-vlan"]?.config;
  if (!config) return "–";
  if (config["interface-mode"] === "TRUNK") {
    const trunk = list(config["trunk-vlans"]);
    const native = config["native-vlan"] !== undefined ? `native ${config["native-vlan"]}, ` : "";
    return `trunk: ${native}${trunk.length ? trunk.join(", ") : "all"}`;
  }
  return `access ${config["access-vlan"] ?? 1}`;
}

function renderPorts(mode) {
  const rows = ports().map((port) => {
    const state = port.state ?? {};
    const counters = state.counters ?? {};
    const enabled = port.config?.enabled ?? true;
    return el(
      "tr",
      {},
      el("td", {}, el("strong", {}, port.name)),
      el("td", {}, enabled ? badge(state["oper-status"]) : el("span", { class: "badge" }, "DISABLED")),
      el("td", {}, portVlan(port, mode)),
      el("td", { class: "wrap" }, port.config?.description ?? ""),
      el("td", { class: "num" }, bytes(counters["in-octets"])),
      el("td", { class: "num" }, bytes(counters["out-octets"])),
      el("td", { class: "mono" }, port["openconfig-if-ethernet:ethernet"].state?.["hw-mac-address"] ?? ""),
      el("td", { class: "num" }, action("Edit", () => editPort(port.name))),
    );
  });
  $("ports").replaceChildren(
    ...(rows.length ? rows : [el("tr", {}, el("td", { colspan: 8, class: "muted" }, "No ports."))]),
  );
}

function renderVlans(mode) {
  const head = (...names) => el("tr", {}, names.map((n) => el("th", {}, n)));
  const edit = (onEdit, onDelete) =>
    el("td", { class: "num actions" }, action("Edit", onEdit), action("Delete", onDelete));
  let rows;
  if (mode === "PORT_BASED") {
    $("vlans-title").textContent = "Port-based VLAN groups";
    $("vlans-head").replaceChildren(head("Group", "Name", "Ports", ""));
    $("vlans-actions").replaceChildren(action("Add group", () => editGroup(null)), action("VLAN mode", editVlanMode));
    rows = current.groups.map((g) =>
      el(
        "tr",
        {},
        el("td", {}, g.id),
        el("td", {}, g.state?.name ?? g.config?.name ?? ""),
        el("td", { class: "wrap" }, list(g.state?.port ?? g.config?.port).join(", ")),
        edit(() => editGroup(Number(g.id)), () => deleteGroup(Number(g.id))),
      ),
    );
  } else {
    $("vlans-title").textContent = "VLANs (802.1Q)";
    $("vlans-head").replaceChildren(head("VLAN", "Name", "Status", "Ports", ""));
    $("vlans-actions").replaceChildren(action("Add VLAN", () => editVlan(null)), action("VLAN mode", editVlanMode));
    rows = current.vlans.map((v) => {
      const state = v.state ?? v.config ?? {};
      const members = list(v.members?.member).map((m) => m.state?.interface);
      return el(
        "tr",
        {},
        el("td", {}, v["vlan-id"]),
        el("td", {}, state.name ?? ""),
        el("td", {}, badge(state.status === "ACTIVE" ? "UP" : state.status ?? "ACTIVE")),
        el("td", { class: "wrap" }, members.join(", ")),
        edit(() => editVlan(Number(v["vlan-id"])), () => deleteVlan(Number(v["vlan-id"]))),
      );
    });
  }
  $("vlans").replaceChildren(
    ...(rows.length ? rows : [el("tr", {}, el("td", { colspan: 5, class: "muted" }, "None."))]),
  );
}

// The tree the port table of the spanning tree card shows: the CIST.
function stpTree(stp) {
  const protocol = unprefixed(stp?.global?.state?.["enabled-protocol"] ?? list(stp?.global?.config?.["enabled-protocol"])[0]);
  if (protocol === "MSTP") {
    return { protocol, state: stp.mstp?.state ?? {}, ports: list(stp.mstp?.["clixon-switch:interfaces"]?.interface) };
  }
  return { protocol, state: stp?.rstp?.state ?? {}, ports: list(stp?.rstp?.interfaces?.interface) };
}

function renderStp(stp) {
  const { protocol, state, ports: treePorts } = stpTree(stp);
  // In MSTP the CIST's bridge leaves are clixon-switch augments.
  const leaf = (name) => state[name] ?? state[`clixon-switch:${name}`];
  const root = leaf("designated-root-address");
  const bridge = leaf("bridge-address");
  $("stp").replaceChildren(
    ...facts([
      ["Protocol", protocol ?? "off"],
      ["Bridge priority", protocol ? leaf("bridge-priority") : null],
      ["Bridge address", bridge],
      [
        "Root bridge",
        root ? `${root}${leaf("designated-root-priority") !== undefined ? ` (priority ${leaf("designated-root-priority")})` : ""}${root === bridge ? " – this switch" : ""}` : null,
      ],
      ["Root port", leaf("root-port")],
      ["Topology changes", leaf("topology-changes")],
    ]),
  );
  const features = list(stp?.interfaces?.interface);
  const rows = ports().map((port) => {
    const tree = treePorts.find((i) => i.name === port.name)?.state ?? {};
    const feature = features.find((i) => i.name === port.name);
    const edge = unprefixed(feature?.state?.["edge-port"] ?? feature?.config?.["edge-port"]);
    return el(
      "tr",
      {},
      el("td", {}, el("strong", {}, port.name)),
      el("td", {}, unprefixed(tree.role) ?? "–"),
      el("td", {}, unprefixed(tree["port-state"]) ?? "–"),
      el("td", {}, { EDGE_ENABLE: "yes", EDGE_DISABLE: "no" }[edge] ?? "auto"),
      el("td", { class: "num" }, tree.cost ?? "auto"),
      el("td", { class: "num" }, tree["port-priority"] ?? ""),
      el("td", { class: "num" }, action("Edit", () => editStpPort(port.name))),
    );
  });
  $("stp-ports").replaceChildren(...rows);
}

function renderSnmp(snmp) {
  const engine = snmp?.engine ?? {};
  const users = list(snmp?.usm?.local?.user);
  $("snmp-actions").replaceChildren(
    action("Add user", editSnmpUser),
    action(engine.enabled ? "Turn off" : "Turn on", toggleSnmp),
  );
  $("snmp").replaceChildren(
    ...facts([
      ["Agent", engine.enabled ? "on (SNMPv3, read-only)" : "off"],
      ["Engine ID", engine["engine-id"] ?? engine["clixon-switch:engine-id-in-use"]],
    ]),
  );
  $("snmp-users").replaceChildren(
    ...(users.length
      ? users.map((u) =>
          el(
            "tr",
            {},
            el("td", {}, u.name),
            el("td", {}, u.priv ? "SHA + AES" : "SHA"),
            el("td", { class: "num" }, action("Delete", () => deleteSnmpUser(u.name))),
          ),
        )
      : [el("tr", {}, el("td", { colspan: 3, class: "muted" }, "No users."))]),
  );
}

// ---------------------------------------------------------------------------
// Unsaved changes: running differs from startup until "Save". Kept per tab
// across reloads; storage may be unavailable, which only loses the hint.

function setUnsaved(unsaved) {
  $("unsaved").hidden = !unsaved;
  $("save").classList.toggle("button", unsaved);
  try {
    if (unsaved) sessionStorage.setItem("unsaved", "1");
    else sessionStorage.removeItem("unsaved");
  } catch {
    // Ignored, see above.
  }
}

async function save() {
  $("save").disabled = true;
  $("status").textContent = "Saving…";
  try {
    await restconf("POST", "operations/ietf-netconf:copy-config", {
      "ietf-netconf:input": { target: { startup: [null] }, source: { running: [null] } },
    });
    setUnsaved(false);
    $("status").textContent = `Saved ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    $("error").textContent = `Cannot save the configuration: ${error.message}`;
    $("error").hidden = false;
    $("status").textContent = "";
  } finally {
    $("save").disabled = false;
  }
}

// ---------------------------------------------------------------------------

let loading = false;

async function refresh() {
  // An open dialog would lose what is being typed.
  if (loading || $("dialog").open) return;
  loading = true;
  $("status").textContent = "Updating…";
  try {
    const [system, interfaces, sw, stpConfig, snmp] = await Promise.all([
      restconfGet("clixon-switch:system"),
      restconfGet("openconfig-interfaces:interfaces", { optional: true }),
      restconfGet("clixon-switch:switch", { optional: true }),
      // The state asks mstpd a few times per port: only while it runs.
      restconfGet("openconfig-spanning-tree:stp?content=config", { optional: true }),
      restconfGet("ietf-snmp:snmp", { optional: true }),
    ]);
    const mode = sw?.state?.["vlan-mode"] ?? sw?.config?.["vlan-mode"] ?? "DOT1Q";
    const stpOn = list(stpConfig?.global?.config?.["enabled-protocol"]).length > 0;
    const [vlans, groups, stp] = await Promise.all([
      mode === "DOT1Q" ? restconfGet("clixon-switch:vlans", { optional: true }) : null,
      mode === "PORT_BASED"
        ? restconfGet("clixon-switch:port-based-vlans", { optional: true })
        : null,
      stpOn ? restconfGet("openconfig-spanning-tree:stp", { optional: true }) : stpConfig,
    ]);
    Object.assign(current, {
      system,
      interfaces: list(interfaces?.interface),
      mode,
      vlans: list(vlans?.vlan),
      groups: list(groups?.group),
      stp,
      snmp,
    });
    renderSystem(system);
    renderManagement(current.interfaces);
    renderPorts(mode);
    renderVlans(mode);
    renderStp(stp);
    renderSnmp(snmp);
    $("error").hidden = true;
    $("status").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    $("error").textContent = `Cannot read the switch's state: ${error.message}`;
    $("error").hidden = false;
    $("status").textContent = "";
  } finally {
    loading = false;
  }
}

$("host").textContent = location.hostname;
$("update").href = `http://${location.hostname}:${UPDATE_PORT}/`;
$("refresh").addEventListener("click", refresh);
$("save").addEventListener("click", save);
$("edit-system").addEventListener("click", () => editSystem());
$("edit-stp").addEventListener("click", () => editStp());
try {
  setUnsaved(sessionStorage.getItem("unsaved") === "1");
} catch {
  setUnsaved(false);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
setInterval(() => {
  if (!document.hidden) refresh();
}, REFRESH_MS);
refresh();
