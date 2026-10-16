# Product specification

## Problem
Developers and data-oriented users often need to reorder records in a JSON or YAML list without building a script or manually editing every line. This tool should make the operation visible, quick, and safe.

## Target users
- Developers editing configuration lists, providers, routes, products, or test fixtures.
- Content and operations teams working with structured data.
- Users who prefer a browser utility over installing a desktop application.

## Product principles
1. **Free to use:** no registration, limits, paid tiers, or donation-gated features.
2. **Local-first:** parse and edit documents in the browser; do not transmit document content.
3. **Transparent:** explain parser errors and any formatting or comment preservation limitations.
4. **Accessible:** keyboard controls for reordering in addition to drag-and-drop; semantic labels; responsive design.
5. **Bilingual from the start:** English and Spanish, with a simple language selector.
6. **Small and maintainable:** avoid backend services unless a future feature truly requires one.

## MVP functionality
- Load local `.json`, `.yaml`, `.yml`, and `.txt` files.
- Paste JSON/YAML text into an editor and parse on demand.
- Auto-detect input format or choose JSON/YAML explicitly.
- Validate that the root is an array of objects.
- Display record summaries and support search.
- Reorder root objects by drag-and-drop or up/down buttons.
- Add, edit, and delete root objects.
- Generate editors from the keys and types in existing objects.
- Edit nested objects and arrays, including add/remove controls for array elements and nested arrays.
- Export as JSON, YAML, or the detected input format; copy output to clipboard.
- Change language between English and Spanish, with the preference saved locally when possible.
- Show configured donation links as optional support, never as a payment requirement.

## Out of scope for MVP
- Editing arbitrary YAML documents, scalars, or mappings at the root.
- Preserving YAML comments, whitespace, anchors, aliases, or original formatting byte-for-byte.
- Accounts, server-side storage, sharing links, or collaboration.
- Direct editing of CSV, XML, TOML, JSON5, or `.env` until a clear mapping design is documented.
- Server-side analytics that could capture document content.

## Acceptance criteria
- Valid JSON arrays and YAML sequences of objects can be loaded by file or pasted text.
- Invalid syntax and a non-array root show an error without replacing the current loaded data.
- Empty arrays are supported; users can add the first object manually.
- Root records can be reordered and the order is reflected in preview and download.
- Existing scalar types are retained where practical (number, boolean, null, string, object, array).
- Any array-valued field shows a control for each item and controls to add/remove items, including nested arrays.
- Download output can be JSON or YAML; “Same as input” uses the detected/loaded format.
- All persistent UI copy is available in English and Spanish.
- No user document content is sent to a remote service by the application.
