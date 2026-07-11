// Citation-coverage gate — guardrail #1, merge-blocking. Exercises the live
// guidance path across every (jurisdiction × change-type) in the corpus and
// asserts 100% citation coverage on every answer the system would render.
// A coverage shortfall would already throw inside enforce(); this gate proves it
// holds across the whole supported surface, not just one path.

import { loadCorpus } from "../api/corpus.ts";
import { answer } from "../api/guidance.ts";
import { checkCoverage } from "../api/citation.ts";
import { GroundedComposer } from "../api/generator.ts";
import type { Generator, GenerateInput } from "../api/generator.ts";
import type { ChangeType } from "../api/types.ts";
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

if (failures.length > 0) fail("citation", `${failures.length} path(s) below 100% coverage`, failures);
pass("citation", `100% citation coverage across ${checked} jurisdiction×change-type paths`);
