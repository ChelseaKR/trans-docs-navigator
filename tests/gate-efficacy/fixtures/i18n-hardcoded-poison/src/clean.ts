// Poison fixture: a correctly-localized counterpart, present so the gate's src/
// walk has a clean file too — every value here is a `${…}` interpolation, so
// nothing here should ever be reported.
export function renderBreadcrumb(label: string, home: string): string {
  return `<nav aria-label="${label}" class="breadcrumb">${home}</nav>`;
}
