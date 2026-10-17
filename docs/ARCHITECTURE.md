# Architecture

## Overview

The application is a static client-side page built with Vite and plain JavaScript modules. It has no backend, database, authentication, or API integration.

```text
index.html (shell + view tabs: List | Prettify | Raw)
  └── src/main.js (UI state, event handlers, list/form rendering)
  └── src/i18n.js (English/Spanish dictionary, tr(), language state)
  └── src/parsers.js (ParserRegistry: json/yaml parse + stringify)
  └── src/model.js (clone, kind, fieldSamples, blankFor, validateValue)
  └── src/views.js (tab switching, no data ownership)
  └── src/style.css
```

## State model

- `data`: the currently edited array of objects.
- `fields`: field names and type samples inferred from all root objects.
- `editIndex`: root object being edited, or `null` when adding.
- `inputSourceFormat`: detected/loaded format used by “Same as input”.
- `language`: interface locale (`en` or `es`).
- `fileBaseName`: safe base filename used for downloads.

## Parsing and serialization

- JSON is parsed with `JSON.parse` and serialized with `JSON.stringify`.
- JSON5 is parsed and serialized by the `json5` package (comments, trailing commas, single quotes, unquoted keys). Output is normalized JSON5; comments are not preserved.
- CSV/TSV is parsed and serialized by `papaparse` under the policy in `docs/FORMATS.md` (header row, cell-type inference, sniffed delimiter remembered for export).
- YAML is parsed and serialized by `js-yaml`.
- Auto-detect tries JSON first, then JSON5, then NDJSON (2+ records only, so a single-line document stays JSON/JSON5, and before CSV because a record with commas sniffs as 2+ columns), then CSV/TSV (2+ columns only), then YAML, so the detected format is the most specific one.
- NDJSON is parsed with `JSON.parse` per line; blank lines are skipped, non-object lines are rejected, and errors carry the 1-based line number.
- A root array is required, and every root item must be a non-null object that is not itself an array.
- “Same as input” exports according to the loaded or detected format.
- Serialization normalizes indentation, quoting, and line wrapping. YAML comments and formatting are not preserved.

## Views

- `List` is the current editor (reorder + form). It is the only view that mutates `data` via controls.
- `Prettify` shows syntax-highlighted output (`src/highlight.js`: keys, strings, numbers, booleans, null, punctuation, comments) in the selected download format; NDJSON is highlighted as JSON per line and CSV/TSV cell by cell. It has an edit mode (textarea + Apply/Cancel) that parses with the shown format and never replaces `data` on syntax errors. All highlighting escapes HTML first, so user data cannot inject markup.
- `Raw` is an editable textarea over the full document. It syncs from `data` on load, on tab enter, and via “Reload from data”; “Apply changes” parses with auto-detect and never replaces `data` on syntax errors (`rawDirty` guards against overwriting in-progress edits).
- The `Auto-detect` input option shows the detected format in parentheses once data is loaded (e.g. `Auto-detect (YAML)`), via `refreshInputFormatLabel()`.
- The download button shows the effective output format (`refreshDownloadBtn()`), and the stats include an `Output: …` pill, so the download format is always visible.
- Because exporting regenerates the document from the edited values, `fidelityNoteKey(format)` in `src/parsers.js` maps the effective output format to a warning key (`fidelityYAML`, `fidelityJSON5`, `fidelityCSV`). `refreshFidelityNote()` shows the matching bilingual note under the format selectors, so users are told before downloading that comments, original indentation, and CSV quoting will not be preserved. JSON and NDJSON lose nothing beyond whitespace and show no note.

## Item modal

`src/modal.js` owns a read-only `<dialog>` detail view per record, opened by clicking (or Enter/Space on) a list row. Dragging a row suppresses the click. The modal shows JSON (highlighted) and Readable (key→value rows, scalar chips, nested lists) tabs, position (`2 of 5`), and Previous/Next navigation (buttons and arrow keys, disabled at the ends). Copy writes the item as JSON; Edit closes the modal and jumps to the List form with a flash ring on the edit zone; Delete confirms and advances the modal (or closes it when the array is empty). All dynamic values use `textContent`, so user data cannot inject markup.

## Form rendering

`fieldSamples()` collects root keys and chooses a sample value for each key. `createInput()` recursively renders editors based on JavaScript value types. Array editors render one row per member plus an add control and a remove control for each row. Object editors recurse into nested values. A type selector appears when an empty array has no sample from which to infer an element type.

Because data is edited in memory and serialized only on preview/copy/download, the input file is not overwritten.

`validateValue()` coerces form input to the sample type before saving. Number samples reject empty or non-finite text; boolean samples accept real booleans from the checkbox and treat the strings `'false'` and `'0'` as `false` (plain `Boolean('false')` would be wrong); array rows keep their own type when it differs from the sample, so no value is silently coerced across types.

## Testing

`tests/run-tests.mjs` (`pnpm test`) exercises everything that does not need a DOM: format detection, the CSV/TSV cell policy, round-trips between every format pair, root-array validation, form value validation, syntax-highlighting escaping, and English/Spanish translation parity. UI behavior (rendering, drag and drop, the modal, downloads) is verified manually with the checklist in `docs/TESTING.md`.

## Internationalization

- Static UI strings use `data-i18n` or `data-i18n-placeholder` attributes.
- Programmatically generated controls and messages use the `translations` dictionary and `tr()` helper.
- Each new visible string must be supplied in English and Spanish.
- The selected locale is stored in local storage if the browser allows it. Failure to access storage must not break the application.

## Donations

Public donation URLs live in `CONFIG.supportLinks` in `src/main.js`. Empty links are not rendered. Do not include private credentials. Donations must remain voluntary and must not gate application functionality.

## Security and privacy

- Treat file and pasted text as untrusted data.
- Prefer DOM APIs and `textContent`; never use user-supplied values as HTML.
- No analytics or remote upload of document data.
- The hosted page may be subject to the static host's access logging and privacy policy.
- Review dependency updates, particularly parser updates, before releasing.
