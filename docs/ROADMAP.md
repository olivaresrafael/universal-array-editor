# Roadmap

This roadmap is a proposal, not a promise or committed schedule.

## Phase 0 — Bilingual JSON/YAML MVP
- [x] JSON and YAML import/export
- [x] File loading and paste-to-load input
- [x] English/Spanish interface selector
- [x] Reorder, search, add/edit/delete root objects
- [x] Recursive nested object and array controls
- [x] Local-first processing and optional donation links
- [ ] Browser-level regression tests for all workflows
- [ ] Accessibility review and manual mobile testing

## Phase 1 — Stability and publishing
- Add a browser test suite for valid/invalid JSON and YAML, output serialization, dynamic arrays, reordering, and language toggle.
- Add a clear warning that YAML comments and original formatting do not round-trip.
- Test keyboard-only operation and touch/mobile layout.
- Publish a public repository and connect continuous deployment to a static hosting service.
- Configure real donation URLs only after verifying provider payouts from the maintainer's account and location.

## Phase 2 — Format improvements
- Consider JSON5 import/export.
- Consider NDJSON / JSON Lines mode.
- Collect examples of CSV/TSV data and define type inference and nested value policy.

## Phase 3 — Quality of life
- Undo/redo for edits and reordering.
- Move item up/down via keyboard shortcuts.
- Better summaries for records that lack name/title/id fields.
- Import/export settings and clearer errors with line/column locations.
- Optional theme preference, if useful and accessible.

## Non-goals unless explicitly approved
- Required accounts, paid functionality, tracking, or ads.
- Uploading source documents to a server.
- A promise to preserve YAML comments or all formatting.
