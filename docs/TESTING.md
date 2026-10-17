# Testing and verification

## Commands

```sh
pnpm run check   # syntax check of every src module
pnpm test         # node unit suite: parsers, model, highlight, translations
pnpm run build    # production bundle
```

`pnpm test` runs `tests/run-tests.mjs`, which covers everything that does not need a DOM: format detection, the CSV/TSV cell policy, NDJSON line rules and line-numbered errors, round-trips between all format pairs, root-array validation, form value validation, syntax highlighting escaping, and English/Spanish translation parity. It uses the synthetic fixtures in `tests/fixtures/`.

A successful build proves that Vite can bundle the project, and the unit suite proves the pure logic, but neither replaces browser testing of the UI.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request: `pnpm install --frozen-lockfile`, then `pnpm test`, `pnpm run check`, and `pnpm run build`. Locally the same three steps are available as `pnpm run verify`.

## Manual regression checklist

### Input and parsing
- [ ] Upload a valid `.json` array of objects.
- [ ] Upload a valid `.json5` file with comments, trailing commas, and unquoted keys.
- [ ] Upload a valid `.csv` file (numbers, booleans, empty cells, quoted commas, nested JSON cell).
- [ ] Upload a valid `.tsv` file.
- [ ] Upload a valid `.jsonl` file; confirm Auto-detect reports NDJSON and the format label shows `(NDJSON)`.
- [ ] Upload a `.ndjson` file with a blank line and confirm the blank line is ignored.
- [ ] Paste NDJSON with a broken line and confirm the error names the line number, in both languages.
- [ ] Paste a single-line JSON document and confirm it stays JSON, not NDJSON.
- [ ] Paste NDJSON records containing commas and confirm it is not detected as CSV.
- [ ] Confirm NDJSON rejects a line holding an array or a number.
- [ ] Paste CSV text and confirm Auto-detect reports CSV; paste single-column text and confirm it does not load as CSV.
- [ ] Verify `01234`-style cells keep leading zeros and `TRUE`/`NULL` map to boolean/null.
- [ ] Upload a valid `.yaml` and `.yml` sequence of objects.
- [ ] Paste valid JSON and load it.
- [ ] Paste valid JSON5 (with a comment) and load it; confirm Auto-detect reports JSON5.
- [ ] Paste valid YAML and load it.
- [ ] Verify Auto-detect with JSON, JSON5, and YAML text.
- [ ] Force JSON while providing YAML and confirm a clear error.
- [ ] Try invalid syntax and a mapping/scalar instead of a root array; the current document should remain unchanged.
- [ ] Try an empty array and add the first object.
- [ ] Try a root array containing a scalar or nested array and confirm the documented validation error.

### Editing
- [ ] Reorder with drag-and-drop.
- [ ] Reorder with up/down buttons and check first/last button disabled states.
- [ ] Search; verify that reorder indices still refer to the underlying complete list.
- [ ] Add, edit, and delete records.
- [ ] Edit number, string, boolean, null, object, and array fields.
- [ ] Add/remove values in an empty array, populated array, array of objects, and nested array.
- [ ] Verify type preservation and add/edit behavior after the field schema changes.

### Output
- [ ] Preview and copy JSON.
- [ ] Download JSON and parse it again.
- [ ] Preview and download YAML, then parse it again.
- [ ] Preview and download JSON5, then parse it again.
- [ ] Preview and download CSV, then parse it again; confirm nested values and `null` round-trip.
- [ ] Set output format to “Same as input” for JSON, JSON5, NDJSON, CSV, TSV, and YAML.
- [ ] Download NDJSON and confirm one record per line with a `.jsonl` extension.
- [ ] Confirm that the download extension matches the actual format.
- [ ] Verify the original local file is never modified.

### Views
- [ ] Prettify tab shows highlighted JSON (keys, strings, numbers, booleans, null, punctuation) and YAML (keys, values, comments).
- [ ] Edit in Prettify, apply valid changes, and confirm List and Raw reflect them; apply invalid syntax and confirm data is unchanged.
- [ ] Cancel an in-progress Prettify edit and confirm the highlighted view is restored.
- [ ] Load with Auto-detect and confirm the input selector shows the detected format in parentheses; switch to explicit JSON/YAML and confirm the suffix disappears.
- [ ] Download button shows the effective format (e.g. “Download YAML”); the stats include an “Output: …” pill.
- [ ] Click a list item (or Enter/Space on it) and confirm the detail modal opens with JSON and Readable views.
- [ ] Navigate with Previous/Next buttons and arrow keys; confirm ends disable the buttons.
- [ ] In the modal, copy JSON, edit (confirm the List form flashes and scrolls into view), and delete (confirm the modal advances or closes when empty).
- [ ] Dragging a row does not open the modal; action buttons still work.

### Internationalization and privacy
- [ ] Switch English → Spanish → English with an array loaded and while editing an item.
- [ ] Verify static labels, dynamic messages, array controls, form actions, and donation text translate.
- [ ] Reload the page and verify the last language selection is restored when storage is available.
- [ ] Test at a narrow mobile viewport.
- [ ] Inspect network activity: document content must not be sent to a server.
- [ ] Verify donation links are hidden when not configured and open safely when configured.

### Fidelity warning
- [ ] Load nothing and confirm the fidelity note is hidden.
- [ ] Load JSON and confirm the note stays hidden while the download format is JSON or NDJSON.
- [ ] Switch the download format to YAML, JSON5, CSV, or TSV and confirm the note appears.
- [ ] Load a YAML file with "Same as input" and confirm the note appears.
- [ ] Switch English → Spanish and confirm the note text is translated.

## Known behavior worth verifying manually

- A single-column table is never auto-detected as CSV (it would be ambiguous with YAML), so it must be loaded with an explicit CSV selection.
- A single-line document is never auto-detected as NDJSON (it would be ambiguous with JSON/JSON5), so it must be loaded with an explicit NDJSON selection.
- CSV/TSV export writes an empty cell for a field a record does not have, so records with different key sets do not round-trip back unchanged.
- Clearing a boolean field's text input keeps it `false` rather than becoming `null`.

## Fixtures

Use only synthetic examples. Do not commit private or customer data to `tests/fixtures/`.
