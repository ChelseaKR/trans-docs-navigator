// Citation-coverage gate — guardrail #1, merge-blocking. Exercises the live
// guidance path across every (jurisdiction × change-type) in the corpus and
// asserts 100% citation coverage on every answer the system would render.
// A coverage shortfall would already throw inside enforce(); this gate proves it
// holds across the whole supported surface, not just one path.

import { loadCorpus } from "../api/corpus.ts";
import { answer } from "../api/guidance.ts";
import { checkCoverage } from "../api/citation.ts";
import type { ChangeType } from "../api/types.ts";
import { pass, fail } from "./util.ts";

const corpus = loadCorpus();
const jurisdictions = [...new Set(corpus.map((r) => r.jurisdiction))].filter((j) => j !== "US");
const changeTypes: ChangeType[] = ["name", "gender-marker"];

const failures: string[] = [];
let checked = 0;

for (const jurisdiction of jurisdictions) {
  for (const ct of changeTypes) {
    let result;
    try {
      result = answer({ jurisdiction, change_types: [ct] });
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
