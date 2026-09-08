# `i18n-exemption-poison`

Substitute identical-by-design lists for the locale-parity gate's controls. Each file is
one way the escape hatch could stop describing the bundles and start describing the
project's history, and the gate has to refuse all of them. The gate reads a substitute
only under `I18N_PARITY_POISON=exemptions-file:<path>`; with the variable unset it always
reads `src/i18n/identical-by-design.json`.
