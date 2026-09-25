// SHA-1 and SNMPv3 key localization, for adding SNMP users. The browser
// has SHA-1 in crypto.subtle, but only in secure contexts, and the page is
// plain HTTP.

"use strict";

function sha1(bytes) {
  const blocks = ((bytes.length + 8) >> 6) + 1;
  const words = new Uint32Array(blocks * 16);
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << (24 - (i & 3) * 8);
  words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length & 3) * 8);
  // Bit length, low word only: the input stays far below 512 MB.
  words[blocks * 16 - 1] = bytes.length * 8;

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let block = 0; block < words.length; block += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[block + t];
    for (let t = 16; t < 80; t++) {
      const x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = (x << 1) | (x >>> 31);
    }
    let [a, b, c, d, e] = h;
    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) [f, k] = [(b & c) | (~b & d), 0x5a827999];
      else if (t < 40) [f, k] = [b ^ c ^ d, 0x6ed9eba1];
      else if (t < 60) [f, k] = [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
      else [f, k] = [b ^ c ^ d, 0xca62c1d6];
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) >>> 0;
      [e, d, c, b, a] = [d, c, (b << 30) | (b >>> 2), a, temp];
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
  }
  const digest = new Uint8Array(20);
  h.forEach((word, i) => {
    for (let j = 0; j < 4; j++) digest[i * 4 + j] = word >>> (24 - j * 8);
  });
  return digest;
}

// "80:00:1f:88:04" → bytes, and back.
const hexOctets = (text) => Uint8Array.from(text.split(":"), (o) => parseInt(o, 16));
const colonHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(":");

// The key ietf-snmp stores for a passphrase: RFC 3414 A.2.2 with SHA-1, as
// clixon-switch-rs's scripts/snmp-localize-key computes it. An AES-128 key
// is the first 16 octets (RFC 3826 1.2).
function localizeKey(passphrase, engineId, octets = 20) {
  const phrase = new TextEncoder().encode(passphrase);
  const repeated = new Uint8Array(1048576);
  for (let i = 0; i < repeated.length; i += phrase.length) {
    repeated.set(phrase.subarray(0, Math.min(phrase.length, repeated.length - i)), i);
  }
  const key = sha1(repeated);
  const engine = hexOctets(engineId);
  const input = new Uint8Array(key.length * 2 + engine.length);
  input.set(key);
  input.set(engine, key.length);
  input.set(key, key.length + engine.length);
  return colonHex(sha1(input).subarray(0, octets));
}
