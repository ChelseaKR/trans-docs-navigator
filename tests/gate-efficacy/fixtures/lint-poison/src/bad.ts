// Poison fixture: a stray console.log in app code — the exact harm lint.ts's
// "no leftover console.log" rule exists to catch.
export function noisy(): void {
  console.log("this should have used api/log.ts");
}
