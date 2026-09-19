// Portable-edition runtime (#233). Injected verbatim into the single-file build by
// scripts/portable-build.ts, ahead of the application modules and the driver.
//
// WHY THIS EXISTS AT ALL. The portable edition must produce the SAME checklist and the
// SAME citations as the server, from `file://`, with no request to anything, ever. The
// only way to guarantee that is to ship the server's own modules unchanged and give them
// somewhere to run — so this file supplies (a) a CommonJS-shaped module registry the
// build's mechanical import rewrite targets, and (b) enough of `node:fs`, `node:path`,
// `node:url`, `node:crypto` and `process` for those modules to load. Not one line of
// api/ or src/ is edited or forked for the portable build. Drift between the two
// editions is therefore not a thing that can happen by omission; it can only happen if
// somebody deliberately changes this shim's semantics, and tests/portable.test.ts pins
// those against the real Node implementations.
//
// PLACEHOLDERS. Two double-underscore tokens below are substituted by the builder, which
// asserts each appears EXACTLY ONCE in this file (so they are described here rather than
// spelled a second time): the first is assigned to `__tdn_vfs` and becomes the virtual
// filesystem, an object mapping "/tdn/<repo-relative path>" to that file's text; the
// second is assigned to `__tdn_build` and carries { built, payload_sha256, generator }.
//
// NO NETWORK, BY CONSTRUCTION. Nothing here can open a socket: no request API of any
// kind is referenced, and there is no dynamic import. The shell's Content-Security-Policy
// (`default-src 'none'; connect-src 'none'`) is the second lock, and the first one is
// that there is nothing here to lock. tests/portable.test.ts scans the assembled bundle
// for the names of the browser's outbound APIs — a blunt substring scan, deliberately, so
// it cannot be evaded and so a future edit that merely NAMES one has to come past a human.
// That is why this paragraph describes them instead of spelling them.

"use strict";

var __tdn_vfs = __TDN_VFS__;
var __tdn_build = __TDN_BUILD__;

// ---------------------------------------------------------------------------
// Bytes. The virtual filesystem stores every file as text because every file it
// carries is UTF-8 (the repo's own i18n-utf8 gate is what makes that safe to assume),
// and a `readFileSync(path)` with no encoding must still hand back BYTES, because
// src/offline.ts feeds those bytes to a sha256 that has to match the server's.
// ---------------------------------------------------------------------------
var __tdn_encoder = new TextEncoder();
function __tdn_bytes(text) {
  return __tdn_encoder.encode(text);
}

// ---------------------------------------------------------------------------
// SHA-256 (FIPS 180-4). Hand-written because the portable edition runs from file://
// where WebCrypto's SubtleCrypto is (a) unavailable on an opaque origin in some
// browsers and (b) asynchronous, while `createHash().digest()` is synchronous and is
// called during module evaluation (src/offline.ts computes SW_VERSION at load).
//
// This is the one place in the portable build where a wrong answer would be invisible,
// so it is NOT trusted on inspection: tests/portable.test.ts checks it against
// node:crypto over the empty input, ASCII, multi-byte UTF-8, every length across two
// block boundaries, and the real shell assets, and separately asserts that the
// portable build's SW_VERSION equals the server's. A hash that is merely
// hash-shaped is exactly the "absence rendered as a value" defect this project keeps
// finding elsewhere, and it would be laundered through a version string here.
// ---------------------------------------------------------------------------
var __TDN_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function __tdn_sha256(bytes) {
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  // Message length in BITS, as two big-endian 32-bit halves: high = len*8 >> 32, which
  // is len / 2^29 without overflowing a 32-bit intermediate.
  var bitLenHi = Math.floor(bytes.length / 536870912);
  var bitLenLo = (bytes.length * 8) >>> 0;
  var withPad = new Uint8Array((((bytes.length + 9 + 63) / 64) | 0) * 64);
  withPad.set(bytes, 0);
  withPad[bytes.length] = 0x80;
  var dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 8, bitLenHi, false);
  dv.setUint32(withPad.length - 4, bitLenLo, false);

  var w = new Uint32Array(64);
  for (var off = 0; off < withPad.length; off += 64) {
    for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (var j = 16; j < 64; j++) {
      var s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
      var s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (var k = 0; k < 64; k++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (hh + S1 + ch + __TDN_K[k] + w[k]) >>> 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  var out = new Uint8Array(32);
  var odv = new DataView(out.buffer);
  for (var q = 0; q < 8; q++) odv.setUint32(q * 4, h[q], false);
  return out;
}

function __tdn_hex(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return s;
}

// ---------------------------------------------------------------------------
// node: shims. Deliberately narrow — every function here exists because a module in
// the shipped graph calls it. An unimplemented member throws rather than returning a
// plausible empty value, because a silently-empty corpus read would render an
// authoritative-looking page with no steps in it.
// ---------------------------------------------------------------------------
function __tdn_normalize(path) {
  var absolute = path.charAt(0) === "/";
  var parts = path.split("/");
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === "" || p === ".") continue;
    if (p === "..") { if (out.length > 0 && out[out.length - 1] !== "..") out.pop(); else if (!absolute) out.push(".."); continue; }
    out.push(p);
  }
  var joined = out.join("/");
  return absolute ? "/" + joined : joined === "" ? "." : joined;
}

var __tdn_path = {
  sep: "/",
  join: function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i] !== "") parts.push(arguments[i]);
    return parts.length === 0 ? "." : __tdn_normalize(parts.join("/"));
  },
  dirname: function (p) {
    var n = __tdn_normalize(p);
    var i = n.lastIndexOf("/");
    if (i < 0) return ".";
    if (i === 0) return "/";
    return n.slice(0, i);
  },
  basename: function (p, ext) {
    var n = __tdn_normalize(p);
    var b = n.slice(n.lastIndexOf("/") + 1);
    if (ext && b.length > ext.length && b.slice(-ext.length) === ext) b = b.slice(0, -ext.length);
    return b;
  },
  extname: function (p) {
    var b = __tdn_path.basename(p);
    var i = b.lastIndexOf(".");
    return i <= 0 ? "" : b.slice(i);
  },
  resolve: function () {
    var out = "/tdn";
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a === "" ) continue;
      out = a.charAt(0) === "/" ? a : out + "/" + a;
    }
    return __tdn_normalize(out);
  },
  relative: function (from, to) {
    var f = __tdn_normalize(from).split("/");
    var t = __tdn_normalize(to).split("/");
    while (f.length > 0 && t.length > 0 && f[0] === t[0]) { f.shift(); t.shift(); }
    var up = [];
    for (var i = 0; i < f.length; i++) up.push("..");
    return up.concat(t).join("/");
  },
};

function __tdn_enoent(path) {
  var err = new Error("ENOENT: no such file or directory, open '" + path + "'");
  err.code = "ENOENT";
  return err;
}

var __tdn_fs = {
  existsSync: function (p) {
    var key = __tdn_normalize(p);
    if (Object.prototype.hasOwnProperty.call(__tdn_vfs, key)) return true;
    var prefix = key + "/";
    for (var k in __tdn_vfs) if (k.indexOf(prefix) === 0) return true;
    return false;
  },
  readFileSync: function (p, enc) {
    var key = __tdn_normalize(p);
    if (!Object.prototype.hasOwnProperty.call(__tdn_vfs, key)) throw __tdn_enoent(key);
    var text = __tdn_vfs[key];
    // `enc` may be a string or an options object, exactly as in node:fs. No encoding
    // means bytes — see __tdn_bytes above for why that distinction is load-bearing.
    if (enc === undefined || enc === null) return __tdn_bytes(text);
    return text;
  },
  readdirSync: function (p) {
    var prefix = __tdn_normalize(p) + "/";
    var names = [];
    for (var k in __tdn_vfs) {
      if (k.indexOf(prefix) !== 0) continue;
      var rest = k.slice(prefix.length);
      var slash = rest.indexOf("/");
      var name = slash < 0 ? rest : rest.slice(0, slash);
      if (names.indexOf(name) < 0) names.push(name);
    }
    if (names.length === 0 && !__tdn_fs.existsSync(p)) throw __tdn_enoent(__tdn_normalize(p));
    return names.sort();
  },
  statSync: function (p) {
    var key = __tdn_normalize(p);
    var isFile = Object.prototype.hasOwnProperty.call(__tdn_vfs, key);
    if (!isFile && !__tdn_fs.existsSync(p)) throw __tdn_enoent(key);
    var size = isFile ? __tdn_bytes(__tdn_vfs[key]).length : 0;
    // mtimeMs is 0 for every entry and that is the honest value: a bundled file has no
    // modification time on the reader's device. The only caller (api/corpus.ts's dev
    // watch) is disabled in the portable build by NODE_ENV=production below, so a
    // constant here can never be mistaken for a real timestamp by anything that runs.
    return {
      size: size,
      mtimeMs: 0,
      isFile: function () { return isFile; },
      isDirectory: function () { return !isFile; },
    };
  },
  writeFileSync: function (p) {
    throw new Error("portable build: the corpus is read-only in the portable edition (write to '" + p + "' refused)");
  },
};

var __tdn_url = {
  fileURLToPath: function (u) {
    var s = String(u);
    if (s.indexOf("file://") !== 0) throw new TypeError("portable build: not a file URL: " + s);
    return decodeURIComponent(s.slice("file://".length));
  },
  pathToFileURL: function (p) {
    return { href: "file://" + __tdn_normalize(p) };
  },
};

var __tdn_crypto = {
  createHash: function (algorithm) {
    if (algorithm !== "sha256") {
      throw new Error("portable build: only sha256 is bundled (asked for '" + algorithm + "')");
    }
    var chunks = [];
    var total = 0;
    return {
      update: function (data) {
        var b = typeof data === "string" ? __tdn_bytes(data) : new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data);
        chunks.push(b);
        total += b.length;
        return this;
      },
      digest: function (encoding) {
        var all = new Uint8Array(total);
        var at = 0;
        for (var i = 0; i < chunks.length; i++) { all.set(chunks[i], at); at += chunks[i].length; }
        var d = __tdn_sha256(all);
        if (encoding === "hex") return __tdn_hex(d);
        if (encoding === undefined) return d;
        throw new Error("portable build: unsupported digest encoding '" + encoding + "'");
      },
    };
  },
};

// `process` for the shipped graph. NODE_ENV is "production" on purpose: it is what
// switches api/corpus.ts off its dev filesystem-watch path (which would stat the whole
// corpus on every call against a filesystem that cannot change), and it leaves
// REPORT_ERROR_LINKS unset so the portable edition renders no link to a GitHub issue
// tracker — a portable copy is exactly the artifact whose reader must not be nudged
// into identifying themselves to a third party.
var __tdn_process = {
  env: { NODE_ENV: "production" },
  argv: ["node", "/tdn/portable"],
  platform: "browser",
  cwd: function () { return "/tdn"; },
};

var __tdn_builtins = {
  "node:fs": __tdn_fs,
  "node:path": __tdn_path,
  "node:url": __tdn_url,
  "node:crypto": __tdn_crypto,
};

// ---------------------------------------------------------------------------
// Module registry. `__tdn_cache[id]` is populated BEFORE the module body runs, so an
// import cycle sees a partially-filled exports object rather than recursing forever.
// The build refuses to emit a bundle whose cycles need anything but hoisted function
// declarations (scripts/portable-build.ts, assertCycleSafety), and each module assigns
// its function exports as its first statements — so the one cycle this graph has
// (src/render.ts <-> src/seo.ts) resolves to real functions, not undefined.
// ---------------------------------------------------------------------------
var __tdn_modules = {};
var __tdn_cache = {};

function __tdn_require(id) {
  if (Object.prototype.hasOwnProperty.call(__tdn_builtins, id)) return __tdn_builtins[id];
  if (Object.prototype.hasOwnProperty.call(__tdn_cache, id)) return __tdn_cache[id];
  var def = __tdn_modules[id];
  if (!def) throw new Error("portable build: module '" + id + "' is not in the bundle");
  var exports = {};
  __tdn_cache[id] = exports;
  def(exports, __tdn_require, __tdn_process);
  return exports;
}
