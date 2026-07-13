// Poison fixture: a clean runtime API file (no direct identity-field references) so PRIVACY_LINT_ROOT can
// point privacy-lint.ts at this whole tree and isolate the harm to src/bad.ts below.
export {};
