# Contributing

Thank you for considering a contribution.

## Before changing behavior
1. Read the relevant documents in `docs/`.
2. Keep the existing local-first promise: user data should not leave the browser.
3. Add English and Spanish translations for every new piece of visible text.
4. Update format support documentation if parsing or export semantics change.

## Local setup

```sh
pnpm install
pnpm run dev
```

Before submitting a change:

```sh
pnpm run check
pnpm run build
```

## Pull request guidance
- Explain the user problem and the intended behavior.
- Include steps to reproduce and verify the change.
- Call out any loss of source formatting, comments, key order, or type fidelity.
- Do not include real customer data, secrets, or payment credentials in fixtures.

## Scope policy
The first release targets arrays whose top-level elements are objects. Format additions such as CSV or XML require a documented mapping strategy before implementation because they do not represent nested JSON/YAML objects in the same way.
