# Deploying the public preview

A live preview of Trans Docs Navigator runs the real app (a `node:http` server, not a
static export), so every route works: the intake, the personalized checklist and packet,
the state-by-state guides, and the in-browser form fill. It is hosted on **Render's free
tier**, chosen specifically so the preview cannot generate a surprise bill.

> **This is a demonstration, not a launched service.** The corpus is illustrative seed
> content with corrected official sources but placeholder verifiers; named-human legal
> verification, counsel review of the disclaimers, and the manual accessibility
> walkthrough remain open gates (see `docs/STATUS.md`). Every page carries the persistent
> "information, not legal advice" disclosure.

## One-time setup (~2 minutes)

The repo is public and ships a `render.yaml` Blueprint, so deploying needs no config:

1. Sign in at <https://render.com> (no credit card required for the free tier).
2. **New → Blueprint**, then connect this GitHub repository. Render reads `render.yaml`
   and creates the web service.
3. First build takes a few minutes (it builds the Dockerfile). After that, pushes to
   `main` redeploy automatically.

Or use the one-click button in the README, which points Render at this repo's Blueprint.

The preview will be served at `https://trans-docs-navigator.onrender.com` (or a similar
URL if that subdomain is taken — Render shows the exact one). The app reads Render's
`RENDER_EXTERNAL_URL` automatically, so canonical/Open Graph/sitemap URLs match the real
preview address with no extra configuration.

## Cost guardrails

The preview is built so the worst case is "it sleeps," never "it bills":

| Guardrail | Effect |
|---|---|
| `plan: free` in `render.yaml` | Hard $0 ceiling; no credit card on file. |
| Free services scale to zero when idle | An unused preview costs nothing; first hit after idle wakes in ~30s. |
| Single instance, no autoscaling | Traffic can't spin up billable instances. |
| Stateless app — no database, disk, or add-ons | Nothing to accrue storage or managed-service charges. |
| Deterministic composer by default (Bedrock off) | No per-request LLM/model cost; the paid path needs `TDN_BEDROCK=aws`, which is not set. |
| Built-in per-IP rate limit (120 req/min) | Bounds abuse and runaway traffic. |

If you later move to a paid plan or a custom domain, set `SITE_ORIGIN` to the real origin
and keep the rate limit (or front it with the host's edge limiter). To raise capacity
without surprise costs, prefer a fixed-size paid instance over autoscaling.

## Verifying it works

After the first deploy, check:

- `https://<your-preview>/healthz` returns `{"status":"ok","corpus_records":35}`
- `https://<your-preview>/` (intake) and `https://<your-preview>/guide` load
- `https://<your-preview>/sitemap.xml` lists the indexable URLs at your real origin

The same checks run locally against the container via `make smoke`.
