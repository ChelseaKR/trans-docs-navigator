// Poison fixture: a clean server.ts (no PII references) so PRIVACY_LINT_ROOT can
// point privacy-lint.ts at this whole tree and isolate the harm to src/bad.ts below.
export {};
