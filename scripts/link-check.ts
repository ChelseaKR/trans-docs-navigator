// Link-rot check (scheduled, not merge-blocking): every corpus source URL must still
// resolve. A dead citation is a broken safety property — the user is told to "confirm
// with the official source" and the link goes nowhere. Run weekly by
// .github/workflows/content-watch.yml, which opens an issue on failure.
//
// HEAD first, GET on 405/501 (some gov servers reject HEAD). Hard-fails only on
// definitive death (404/410) or DNS/conn errors; 403/429/5xx are reported as warnings
// since gov sites often bot-block, and a block is not rot.
//
// ── Why a THIRD outcome exists: `tls-chain-incomplete` ──────────────────────────────
// Link rot and server misconfiguration are different facts about the world, and this gate
// used to collapse them into one. CDPH (`www.cdph.ca.gov`) sends only its LEAF certificate
// and omits the Sectigo intermediate that signs it. Browsers paper over this by fetching
// the missing intermediate from the certificate's AIA extension; a strict client cannot,
// so Node's fetch throws `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and the old code reported the
// bare `TypeError` as **"dead"**. Four CDPH links — a live birth-record page, a live fee
// page, and two live forms, all serving HTTP 200 to a browser right now — were being
// reported as rot. That is a false alarm in a gate whose entire job is to be believed, and
// a gate that cries wolf gets switched off.
//
// The distinguishing evidence is in the error itself, not in a guess: a chain-validation
// failure means we *completed a TCP connection and a TLS handshake and were handed a
// certificate*. A dead host does not do that — it fails with ENOTFOUND / ECONNREFUSED /
// a timeout, which this gate still reports as dead. So the chain error proves the server
// is up and serving; what is broken is its certificate chain, not the link.
//
// We then confirm liveness (and the real HTTP status) through a chain-completing client —
// curl, which completes the chain from the certificate's AIA exactly as a browser does.
// ⚠️ CERTIFICATE VERIFICATION IS NEVER DISABLED. There is no `-k`/`--insecure`, no
// `rejectUnauthorized: false`, and no `NODE_TLS_REJECT_UNAUTHORIZED=0` anywhere in this
// file. Completing a chain the server should have sent is not the same as skipping
// validation: the certificate is still verified to a trusted root. Turning verification
// off would make this gate assert "the link is fine" on evidence it never checked, which
// is the same class of dishonesty as spoofing a browser user-agent past a host that has
// said no (see docs/OPERATIONS.md) — we do neither.
//
// A `tls-chain-incomplete` URL is NOT counted as rot and does NOT fail the build, but it is
// named, counted, and printed on every single run so it can never quietly become invisible.
// It is a real defect — in CDPH's server, not in our corpus — and the honest report says so.

import { execFileSync } from "node:child_process";
import { loadCorpus } from "../api/corpus.ts";
import { loadForms } from "../api/forms.ts";
import { pass, fail } from "./util.ts";

const TIMEOUT_MS = 15_000;
const UA = "trans-docs-navigator-link-check/1.0 (+https://github.com/ChelseaKR/trans-docs-navigator)";

/**
 * Error codes that mean "the chain could not be built", i.e. the server did not send the
 * intermediate(s) that link its leaf certificate to a trusted root. Every one of these is
 * raised only AFTER a TLS handshake in which the server presented a certificate — so they
 * are positive evidence the host is alive, and are never treated as link rot.
 */
const TLS_CHAIN_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);

/** The chain-validation code buried in a fetch TypeError's cause chain, if any. */
export function tlsChainErrorCode(err: unknown): string | undefined {
  let cause: unknown = (err as { cause?: unknown })?.cause;
  for (let depth = 0; cause !== undefined && cause !== null && depth < 4; depth++) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === "string" && TLS_CHAIN_CODES.has(code)) return code;
    cause = (cause as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Real HTTP status via a client that can complete the chain from the certificate's AIA,
 * the way a browser does. Certificate verification stays ON — no `-k`, no `--insecure`.
 * Returns null if curl is unavailable or also cannot complete the chain (e.g. an OpenSSL
 * build that does not do AIA fetching); the caller still does not call the link dead,
 * because the chain error already proved the host answered with a certificate.
 */
function statusViaChainCompletingClient(url: string): number | null {
  try {
    const out = execFileSync(
      "curl",
      ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-L", "--max-time", "25", "-A", UA, url],
      { encoding: "utf8" },
    );
    const code = Number(out.trim());
    return Number.isFinite(code) && code > 0 ? code : null;
  } catch {
    return null;
  }
}

export type ProbeResult =
  | { kind: "alive"; note?: string }
  | { kind: "dead"; note: string }
  | { kind: "tls-chain-incomplete"; note: string };

async function probe(url: string): Promise<ProbeResult> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": UA },
      });
      if (res.status === 405 || res.status === 501) continue; // try GET
      if (res.status === 404 || res.status === 410) return { kind: "dead", note: `HTTP ${res.status}` };
      if (!res.ok) {
        return { kind: "alive", note: `HTTP ${res.status} (warning — possibly bot-blocked, not rot)` };
      }
      return { kind: "alive" };
    } catch (err) {
      const code = tlsChainErrorCode(err);
      if (code !== undefined) {
        // The server presented a certificate but did not send the intermediate that signs
        // it. The host is up; its TLS config is wrong. Confirm the status through a
        // chain-completing client (verification still ON) before saying anything more.
        const status = statusViaChainCompletingClient(url);
        if (status === 404 || status === 410) {
          return { kind: "dead", note: `HTTP ${status} (and the server's cert chain is incomplete: ${code})` };
        }
        return {
          kind: "tls-chain-incomplete",
          note:
            status === null
              ? `${code} — the server does not send its intermediate certificate. The host answered ` +
                `with a cert, so this is a server TLS misconfiguration, not rot; liveness could not be ` +
                `independently confirmed here (no chain-completing client available).`
              : `${code} — the server does not send its intermediate certificate; a browser repairs this ` +
                `via AIA. The link is ALIVE (HTTP ${status} via a chain-completing client, verification ON).`,
        };
      }
      if (method === "GET") return { kind: "dead", note: (err as Error).name };
    }
  }
  return { kind: "alive" };
}

// Both corpus citations and the official-form links must stay live — a dead form link
// sends a user nowhere. (The form links rotted undetected before this gate covered them.)
const urls = [...new Set([...loadCorpus().map((r) => r.source.url), ...loadForms().map((f) => f.source.url)])];
const dead: string[] = [];
const warnings: string[] = [];
const tlsMisconfigured: string[] = [];

for (const url of urls) {
  const r = await probe(url);
  if (r.kind === "dead") dead.push(`${url} — ${r.note}`);
  else if (r.kind === "tls-chain-incomplete") tlsMisconfigured.push(`${url} — ${r.note}`);
  else if (r.note) warnings.push(`${url} — ${r.note}`);
}

for (const w of warnings) console.log(`  ⚠️  ${w}`);

// Printed on every run, pass or fail. This is a real defect in someone else's server, and
// the moment it stops being visible is the moment it stops being fixed.
if (tlsMisconfigured.length > 0) {
  console.log("");
  console.log(`  🔒 ${tlsMisconfigured.length} URL(s) served over an INCOMPLETE TLS CHAIN (server misconfiguration, NOT link rot):`);
  for (const t of tlsMisconfigured) console.log(`     · ${t}`);
  console.log("     These links work in a browser. They are not counted as dead. Certificate verification");
  console.log("     was never disabled to reach them — see the header of scripts/link-check.ts and");
  console.log("     docs/OPERATIONS.md. The fix belongs to the host: it must send its intermediate cert.");
  console.log("");
}

if (dead.length > 0) fail("link-check", `${dead.length}/${urls.length} source URL(s) dead`, dead);
pass(
  "link-check",
  `${urls.length} source URLs resolve (${warnings.length} warning(s), ${tlsMisconfigured.length} incomplete-TLS-chain)`,
);
