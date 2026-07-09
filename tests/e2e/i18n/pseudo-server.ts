// G9 — test-only server entry for the pseudolocale overflow gate.
//
// The app is server-rendered: the active locale is chosen by `?language=` and
// resolved through t()/asLanguage() (src/i18n/index.ts). There is no client i18n
// instance to inject into, so the SSR-faithful analog of "expose the resolver
// behind a build-time test flag" is to register the generated `en-XA` pseudolocale
// in the resolver HERE — behind TDN_I18N_TEST_HOOKS=1 — before the server boots.
//
// This is a TEST entry, distinct from the production entry (api/server.ts), which
// never registers en-XA. With the flag set, `?language=en-XA` renders the pseudo
// bundle; en/es render exactly as in production. Playwright starts this via its
// webServer config; the overflow spec then drives `?language=en-XA` routes.
//
// Registration happens before `api/server.ts` is imported (it starts listening on
// import), so the pseudo locale is resolvable from the first request.

import { registerTestLocale } from "../../../src/i18n/index.ts";
import { en } from "../../../src/i18n/en.ts";
import { makePseudoBundle } from "../../../scripts/i18n-pseudo.ts";

if (process.env.TDN_I18N_TEST_HOOKS === "1") {
  registerTestLocale("en-XA", makePseudoBundle(en));
}

// Boot the real server only after the pseudolocale is registered.
await import("../../../api/server.ts");
