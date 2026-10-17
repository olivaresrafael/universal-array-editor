# Contributing

Thank you for considering a contribution.

## Before changing behavior
1. Read the relevant documents in `docs/`.
2. Keep the existing local-first promise: user data should not leave the browser.
3. Add English and Spanish translations for every new piece of visible text.
4. Update format support documentation if parsing or export semantics change.
5. Add cases to `tests/run-tests.mjs` for any new parsing, serialization, validation, or highlighting logic.

## Local setup

```sh
pnpm install
pnpm run dev
```

Before submitting a change:

```sh
pnpm test
pnpm run check
pnpm run build
```

## Pull request guidance
- Explain the user problem and the intended behavior.
- Include steps to reproduce and verify the change.
- Call out any loss of source formatting, comments, key order, or type fidelity.
- Do not include real customer data, secrets, or payment credentials in fixtures.

## Scope policy
The editor targets arrays whose top-level elements are objects. Supported formats are JSON, JSON5, CSV/TSV, and YAML. A new format must ship with a documented mapping strategy in `docs/FORMATS.md` and fixtures in `tests/fixtures/`, because tabular and markup formats do not represent nested objects in the same way.
