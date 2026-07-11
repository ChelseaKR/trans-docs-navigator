// Poison fixture: a PII field logged directly — the exact harm privacy-lint.ts's
// "no PII in logs" invariant exists to catch.
export function debugDump(current_legal_name: string): void {
  console.log("debugging intake", current_legal_name);
}
