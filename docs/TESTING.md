# Testing and verification

## Commands

```sh
pnpm run check
pnpm run build
```

A successful build proves that Vite can bundle the project, but it does not replace browser testing.

## Manual regression checklist

### Input and parsing
- [ ] Upload a valid `.json` array of objects.
- [ ] Upload a valid `.json5` file with comments, trailing commas, and unquoted keys.
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
- [ ] Set output format to “Same as input” for JSON, JSON5, and YAML.
- [ ] Confirm that the download extension matches the actual format.
- [ ] Verify the original local file is never modified.

### Views
- [ ] Prettify tab shows highlighted JSON (keys, strings, numbers, booleans, null, punctuation) and YAML (keys, values, comments).
- [ ] Edit in Prettify, apply valid changes, and confirm List and Raw reflect them; apply invalid syntax and confirm data is unchanged.
- [ ] Cancel an in-progress Prettify edit and confirm the highlighted view is restored.
- [ ] Load with Auto-detect and confirm the input selector shows the detected format in parentheses; switch to explicit JSON/YAML and confirm the suffix disappears.

### Internationalization and privacy
- [ ] Switch English → Spanish → English with an array loaded and while editing an item.
- [ ] Verify static labels, dynamic messages, array controls, form actions, and donation text translate.
- [ ] Reload the page and verify the last language selection is restored when storage is available.
- [ ] Test at a narrow mobile viewport.
- [ ] Inspect network activity: document content must not be sent to a server.
- [ ] Verify donation links are hidden when not configured and open safely when configured.

## Fixtures

Use only synthetic examples. Do not commit private or customer data to `tests/fixtures/`.
