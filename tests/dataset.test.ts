// Dataset release pipeline (EXP-08). Runs scripts/dataset-build.ts (and
// scripts/dataset-diff.ts) as real subprocesses against a scratch directory — these
// are release scripts, not library code, so exercising them the way CI/a release
// author does is more honest than importing internals.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(script: string, args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function buildInto(dir: string) {
  const res = run("scripts/dataset-build.ts", [dir]);
  assert.equal(res.status, 0, `dataset-build failed:\n${res.stderr}`);
  return res;
}

function withTmpDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "dataset-build-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("dataset-build emits schema, records, verifiers, labels, and manifest", () => {
  withTmpDir((dir) => {
    buildInto(dir);
    for (const f of ["schema.json", "records.json", "verifiers.json", "labels.json", "manifest.json"]) {
      const parsed = JSON.parse(readFileSync(join(dir, f), "utf8"));
      assert.ok(parsed !== null, `${f} should parse as JSON`);
    }
  });
});

test("dataset-build exits 0 and record_count matches the data-card (32)", () => {
  withTmpDir((dir) => {
    buildInto(dir);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    const records = JSON.parse(readFileSync(join(dir, "records.json"), "utf8"));
    assert.equal(manifest.record_count, 32);
    assert.equal(records.length, 32);
  });
});

test("every emitted record validates against the emitted schema", () => {
  withTmpDir((dir) => {
    buildInto(dir);
    const schema = JSON.parse(readFileSync(join(dir, "schema.json"), "utf8"));
    const records = JSON.parse(readFileSync(join(dir, "records.json"), "utf8"));
    assert.ok(records.length > 0);

    const jurisdictionRe = new RegExp(schema.properties.jurisdiction.pattern);
    const urlRe = new RegExp(schema.properties.source.properties.url.pattern);
    const dateRe = new RegExp(schema.properties.source.properties.last_verified.pattern);

    for (const rec of records) {
      for (const field of schema.required) {
        assert.notEqual(rec[field], undefined, `record ${rec.id} missing required field "${field}"`);
      }
      assert.ok(
        schema.properties.document_type.enum.includes(rec.document_type),
        `${rec.id}: document_type "${rec.document_type}" not in schema enum`,
      );
      assert.ok(Array.isArray(rec.change_type) && rec.change_type.length > 0);
      for (const c of rec.change_type) {
        assert.ok(schema.properties.change_type.items.enum.includes(c), `${rec.id}: change_type "${c}" not in schema enum`);
      }
      assert.ok(schema.properties.verification_status.enum.includes(rec.verification_status));
      assert.ok(schema.properties.language.enum.includes(rec.language));
      assert.ok(jurisdictionRe.test(rec.jurisdiction), `${rec.id}: jurisdiction "${rec.jurisdiction}" fails schema pattern`);
      assert.ok(rec.statement.length >= schema.properties.statement.minLength);
      assert.ok(urlRe.test(rec.source.url));
      assert.ok(dateRe.test(rec.source.last_verified));
      assert.notEqual(rec.source.verifier, "UNVERIFIED");
    }
  });
});

test("every record's source.verifier appears in verifiers.json's roster", () => {
  withTmpDir((dir) => {
    buildInto(dir);
    const records = JSON.parse(readFileSync(join(dir, "records.json"), "utf8"));
    const verifiers = JSON.parse(readFileSync(join(dir, "verifiers.json"), "utf8"));
    const rosterNames = new Set((verifiers.roster ?? []).map((v: { name: string }) => v.name));
    for (const rec of records) {
      assert.ok(rosterNames.has(rec.source.verifier), `${rec.id}: verifier "${rec.source.verifier}" not in roster`);
    }
  });
});

test("a placeholder verifier forces launch_cleared:false for every jurisdiction it touches", () => {
  withTmpDir((dir) => {
    buildInto(dir);
    const records = JSON.parse(readFileSync(join(dir, "records.json"), "utf8"));
    const verifiers = JSON.parse(readFileSync(join(dir, "verifiers.json"), "utf8"));
    const labels = JSON.parse(readFileSync(join(dir, "labels.json"), "utf8"));
    const placeholderNames = new Set(
      (verifiers.roster ?? []).filter((v: { placeholder?: boolean }) => v.placeholder === true).map((v: { name: string }) => v.name),
    );

    const jurisdictionsWithPlaceholder = new Set(
      records.filter((r: { source: { verifier: string } }) => placeholderNames.has(r.source.verifier)).map((r: { jurisdiction: string }) => r.jurisdiction),
    );

    assert.ok(jurisdictionsWithPlaceholder.size > 0, "expected the seed corpus to still carry a placeholder verifier");
    for (const j of jurisdictionsWithPlaceholder) {
      assert.equal(
        labels[j as string].mechanical_verification_complete,
        false,
        `jurisdiction ${j} has a placeholder verifier but mechanical verification is complete`,
      );
      assert.equal(labels[j as string].launch_cleared, false, `jurisdiction ${j} has a placeholder verifier but launch_cleared !== false`);
    }
    // A generated artifact may report mechanical evidence, but it must never grant
    // the counsel/community/human launch gate on its own.
    for (const label of Object.values(labels) as { launch_cleared: boolean }[]) {
      assert.equal(label.launch_cleared, false);
    }
    // Every label's counts must sum to the jurisdiction's record count.
    for (const [j, l] of Object.entries(labels) as [string, { verified: number; needs_reverification: number; unverified: number }][]) {
      const count = records.filter((r: { jurisdiction: string }) => r.jurisdiction === j).length;
      assert.equal(l.verified + l.needs_reverification + l.unverified, count, `label counts for ${j} don't sum to its record count`);
    }
  });
});

test("manifest.json's file hashes match the emitted files", () => {
  withTmpDir((dir) => {
    buildInto(dir);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    for (const [name, hash] of Object.entries(manifest.files) as [string, string][]) {
      const content = readFileSync(join(dir, name), "utf8");
      assert.equal(createHash("sha256").update(content).digest("hex"), hash, `hash mismatch for ${name}`);
    }
    assert.ok(manifest.source_hashes && Object.keys(manifest.source_hashes).length > 0);
  });
});

test("dataset-diff reports added/removed/changed records between two builds", () => {
  withTmpDir((dirA) => {
    buildInto(dirA);
    withTmpDir((dirB) => {
      const records = JSON.parse(readFileSync(join(dirA, "records.json"), "utf8"));
      const mutated = records.slice(1); // drop one (removed)
      mutated[0] = { ...mutated[0], statement: mutated[0].statement + " CHANGED", source: { ...mutated[0].source, verifier: "Test Changed Verifier" } };
      mutated.push({ ...records[0], id: "zz.synthetic.added-record" }); // add one
      writeFileSync(join(dirB, "records.json"), JSON.stringify(mutated, null, 2));

      withTmpDir((outDir) => {
        const res = run("scripts/dataset-diff.ts", [dirA, dirB, outDir]);
        assert.equal(res.status, 0, res.stderr);
        const diff = JSON.parse(readFileSync(join(outDir, "diff.json"), "utf8"));
        assert.equal(diff.added.length, 1);
        assert.equal(diff.added[0], "zz.synthetic.added-record");
        assert.equal(diff.removed.length, 1);
        assert.equal(diff.changed.length, 1);
        assert.equal(diff.changed[0].verifier.new, "Test Changed Verifier");
        assert.ok(diff.changed[0].fields.some((f: { field: string }) => f.field === "statement"));

        const changelog = readFileSync(join(outDir, "changelog.md"), "utf8");
        assert.match(changelog, /## Added/);
        assert.match(changelog, /## Removed/);
        assert.match(changelog, /## Changed/);
        assert.match(changelog, /Test Changed Verifier/);
      });
    });
  });
});
