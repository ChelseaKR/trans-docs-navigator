// Browser module: wires the "download reminders (.ics)" button on load. Exports the pure
// .ics builder so the test suite can execute and assert it under jsdom.
export function buildIcs(summaries: string[], stamp: string): string;
