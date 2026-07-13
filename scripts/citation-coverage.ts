// Citation-coverage gate — guardrail #1, merge-blocking. Exercises the live
// guidance path across every (jurisdiction × change-type) in the corpus and
// asserts 100% citation coverage on every answer the system would render.
// A coverage shortfall would already throw inside enforce(); this gate proves it
// holds across the whole supported surface, not just one path.

import { loadCorpus } from "../api/corpus.ts";
import { answer } from "../api/guidance.ts";
import { relocationAnswer } from "../api/relocation.ts";
import { checkCoverage } from "../api/citation.ts";
import { GroundedComposer } from "../api/generator.ts";
import type { Generator, GenerateInput } from "../api/generator.ts";
import type { ChangeType, DocumentType, Language } from "../api/types.ts";
import { pass, fail } from "./util.ts";

// Test-only injection point (tests/gate-efficacy): CITATION_POISON=uncited-claim wraps
// the default deterministic generator and strips the citation off its first claim
// block, simulating a generator (e.g. a future model path) that emits an uncited
// claim. The composer is faithful-by-construction, so there is no corpus fixture that
// alone reproduces this harm — the gate script is the only place this can be wired in.
// Inert unless the env var is exactly "uncited-claim", so production behavior (no
// `generator` override passed to answer()) is unchanged.
class UncitedClaimPoisonGenerator implements Generator {
  private readonly inner = new GroundedComposer();
  generate(input: GenerateInput) {
    const draft = this.inner.generate(input);
    let stripped = false;
    const blocks = draft.blocks.map((b) => {
      if (!stripped && b.kind === "claim" && b.citations.length > 0) {
        stripped = true;
        return { ...b, citations: [] };
      }
      return b;
    });
    return { ...draft, blocks };
  }
}
const poisonGenerator: Generator | undefined =
  process.env.CITATION_POISON === "uncited-claim" ? new UncitedClaimPoisonGenerator() : undefined;

const corpus = loadCorpus();
const jurisdictions = [...new Set(corpus.map((r) => r.jurisdiction))].filter((j) => j !== "US");
const changeTypes: ChangeType[] = ["name", "gender-marker"];
const languages: Language[] = ["en", "es"];

const failures: string[] = [];
let checked = 0;

for (const jurisdiction of jurisdictions) {
  for (const ct of changeTypes) {
    let result;
    try {
      result = answer(
        { jurisdiction, change_types: [ct] },
        poisonGenerator ? { generator: poisonGenerator } : {},
      );
    } catch (e) {
      failures.push(`${jurisdiction}/${ct}: enforce() rejected — ${(e as Error).message}`);
      continue;
    }
    checked++;
    const report = checkCoverage(result, corpus);
    if (report.coverage < 1) {
      failures.push(
        `${jurisdiction}/${ct}: coverage ${(report.coverage * 100).toFixed(1)}% (${report.cited}/${report.claims})`,
      );
    }
  }
}

// ── Relocation planner (docs/RELOCATION.md) ────────────────────────────────────────
// The delta engine composes a plan out of corpus records, so guardrail #1 has to hold on
// that surface too — and it has to hold across the whole (origin × destination) matrix, not
// just the TX→WA case the tests use. relocationAnswer() runs each plan through the SAME
// citation.enforce() as /answer, so a plan containing a claim that isn't backed by a
// current, resolvable record throws here rather than rendering. Both languages: the Spanish
// corpus is thinner (Washington has no ES records yet), and a plan that quietly fell back to
// English records for a Spanish user would be an uncited claim in the user's language.
let relocationChecked = 0;
for (const origin of jurisdictions) {
  for (const destination of jurisdictions) {
    if (origin === destination) continue;
    for (const language of languages) {
      // Both the "holds nothing" and "already holds a court order" branches: they take
      // different classification paths (redo-in-destination vs keep-from-origin) and so
      // cite different records.
      for (const held of [[], ["court-order"]] as DocumentType[][]) {
        let plan;
        try {
          plan = relocationAnswer({
            origin,
            destination,
            held,
            change_types: [...changeTypes],
            language,
          });
        } catch (e) {
          failures.push(
            `relocation ${origin}→${destination}/${language}/held=[${held.join(",")}]: enforce() rejected — ${(e as Error).message}`,
          );
          continue;
        }
        relocationChecked++;
        const report = checkCoverage(plan, corpus);
        if (report.coverage < 1) {
          failures.push(
            `relocation ${origin}→${destination}/${language}: coverage ${(report.coverage * 100).toFixed(1)}% (${report.cited}/${report.claims})`,
          );
        }
      }
    }
  }
}

if (failures.length > 0) fail("citation", `${failures.length} path(s) below 100% coverage`, failures);
pass(
  "citation",
  `100% citation coverage across ${checked} jurisdiction×change-type paths and ${relocationChecked} relocation (origin×destination×language×held) plans`,
);
