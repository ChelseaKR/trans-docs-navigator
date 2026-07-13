// Poison fixture: direct identity-field handling in runtime API code outside server.ts.
export function unsafeIdentityHandler(current_legal_name: string): string {
  return current_legal_name;
}
