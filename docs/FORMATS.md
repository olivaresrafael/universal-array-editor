# Format support and future format proposals

## Supported now

| Format | Import | Paste | Export | Notes |
| --- | --- | --- | --- | --- |
| JSON | Yes | Yes | Yes | Native browser parser; standard JSON only. |
| JSON5 | Yes | Yes | Yes | Parsed and serialized with the `json5` package; supports comments, trailing commas, single quotes, and unquoted keys. Output is normalized JSON5 (comments are not preserved). |
| YAML | Yes | Yes | Yes | Parsed and serialized with `js-yaml`; comments and original whitespace are not preserved. |
| `.txt` containing JSON/JSON5/YAML | Yes | Yes | N/A | Input must still parse as a supported document. |

The top-level value must be an array/sequence of objects. This is intentionally narrower than a general-purpose format converter so the reordering UI remains predictable.

## Proposed additions

| Priority | Format | Why it could help | Design questions / trade-offs |
| --- | --- | --- | --- |
| 1 | CSV and TSV | Useful for product lists, spreadsheets, simple catalogs, and tabular records. | Need a documented policy for type inference, escaped delimiters, empty cells, nested objects, and arrays. Nested structures could be left as JSON strings in cells or unsupported. |
| 2 | NDJSON / JSON Lines (`.jsonl`) | Common for logs and data pipelines; one JSON object per line. | Define whether blank lines are ignored, how line-level errors are reported, and how exports preserve one-record-per-line layout. |
| 3 | TOML | Helpful for configuration editing, especially arrays of tables. | TOML's common shape is a mapping/table rather than a root list; add a clear adapter for arrays of tables and declare which structures are editable. |
| 4 | XML | Needed in older enterprise systems and integrations. | XML-to-object mappings are not universal: attributes, repeated tags, namespaces, text nodes, and ordering require explicit mapping rules. Avoid promising lossless round-tripping initially. |
| 5 | `.env` / key-value config | Familiar to developers and useful for small config lists. | Does not naturally represent an array of objects; better as a separate key-value editor or a later dedicated mode, not a simple extension of the current root-array flow. |

## Recommended product decision

Keep the current focus on JSON, JSON5, and YAML. If user feedback confirms demand, implement CSV/TSV next with an explicit column-to-type policy. NDJSON is also a strong developer-focused option and may be a smaller addition than TOML or XML.

Each new format should have a parser/serializer abstraction, fixtures, bilingual errors, and a documented fidelity statement before release. Do not silently coerce unknown structures.
