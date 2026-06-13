# Security Policy

This project serves a population for whom privacy failures can mean real-world harm.
Security reports are treated with that weight.

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/ChelseaKR/trans-docs-navigator/security/advisories/new)
("Report a vulnerability"). Do not open a public issue for anything that could put
users at risk before a fix ships.

You can expect an acknowledgment within 72 hours. Coordinated disclosure is welcome;
credit is given unless you prefer otherwise.

## Scope notes for researchers

- The service is designed to hold **no server-side PII**: no accounts, no identity
  fields on the wire, allowlist-only logging, client-side form fill. Anything that
  causes identity data to reach a server or a log is the highest-severity class here.
- The optional save/resume feature stores an AES-GCM-encrypted, passphrase-derived
  (PBKDF2, 600k iterations) blob in the user's own localStorage. Weaknesses in that
  construction or its implementation (public/assets/resume-crypto.js) are in scope.
- The citation pipeline is a safety control: any way to render a claim without its
  citation, or to smuggle model output past `citation.enforce()`, is in scope even
  though it isn't a classic security bug.

## Supported versions

The `main` branch only; there are no maintained release lines yet.
