// Poison fixture: a landmark label typed in English by hand in a rendering
// template instead of sourced from the locale bundle — the exact harm
// i18n-hardcoded-attrs.ts exists to catch (issue #151).
export function renderAnswerSection(body: string): string {
  return `<section aria-label="answer">${body}</section>`;
}
