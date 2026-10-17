# Format support and future format proposals

## Supported now

| Format | Import | Paste | Export | Notes |
| --- | --- | --- | --- | --- |
| JSON | Yes | Yes | Yes | Native browser parser; standard JSON only. |
| JSON5 | Yes | Yes | Yes | Parsed and serialized with the `json5` package; supports comments, trailing commas, single quotes, and unquoted keys. Output is normalized JSON5 (comments are not preserved). |
| CSV / TSV | Yes | Yes | Yes | Parsed and serialized with `papaparse`. See the CSV policy below. |
| YAML | Yes | Yes | Yes | Parsed and serialized with `js-yaml`; comments and original whitespace are not preserved. |
| `.txt` containing a supported document | Yes | Yes | N/A | Input must still parse as a supported document. |

The top-level value must be an array/sequence of objects. This is intentionally narrower than a general-purpose format converter so the reordering UI remains predictable.

## CSV / TSV policy

- **Delimiter:** sniffed from the input (`,`, tab, `;`, `|`). A `.tsv` file or explicit TSV selection forces tab. “Same as input” exports keep the detected delimiter (e.g. `;`-separated files stay `;`-separated).
- **Header row:** the first row defines field names. Headers are trimmed; empty headers become `column_N`; duplicates are suffixed (`name`, `name_2`, …). Cells beyond the header width are ignored.
- **Minimum shape:** a header row plus at least one data row is required. Auto-detect additionally requires 2+ columns so YAML documents are never misdetected; single-column files need an explicit CSV selection.
- **Cell types:** empty cells become `''`; `true`/`false` (any case) become booleans; `null` (any case) becomes null; finite JSON numbers become numbers (`01234` keeps its leading zero as a string); cells holding JSON objects/arrays become nested values; everything else stays a string.
- **Export:** nested objects/arrays are written as JSON inside the cell; null is written as `null`; missing fields become empty cells. Headers are the union of all record keys, in first-seen order.
- Quoting, line breaks inside quoted cells, and formatting are normalized on export.

## Proposed additions

| Priority | Format | Why it could help | Design questions / trade-offs |
| --- | --- | --- | --- |
| 1 | NDJSON / JSON Lines (`.jsonl`) | Common for logs and data pipelines; one JSON object per line. | Define whether blank lines are ignored, how line-level errors are reported, and how exports preserve one-record-per-line layout. |
| 2 | TOML | Helpful for configuration editing, especially arrays of tables. | TOML's common shape is a mapping/table rather than a root list; add a clear adapter for arrays of tables and declare which structures are editable. |
| 3 | XML | Needed in older enterprise systems and integrations. | XML-to-object mappings are not universal: attributes, repeated tags, namespaces, text nodes, and ordering require explicit mapping rules. Avoid promising lossless round-tripping initially. |
| 4 | `.env` / key-value config | Familiar to developers and useful for small config lists. | Does not naturally represent an array of objects; better as a separate key-value editor or a later dedicated mode, not a simple extension of the current root-array flow. |

## Recommended product decision

The current format set is JSON, JSON5, CSV/TSV, and YAML. If user feedback confirms demand, implement NDJSON next (minimal conceptual change over the line-based CSV work). TOML and XML need explicit mapping designs before implementation.

Each new format should have a parser/serializer abstraction, fixtures, bilingual errors, and a documented fidelity statement before release. Do not silently coerce unknown structures.
