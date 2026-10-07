# Evidence lessons

Hard-won lessons for evidence capture and privacy.

**Evidence and privacy**
- Retained raw tool output is hashed (`SHA256SUMS` with its verify output beside it,
  not self-listed). Mark evidence folders `-whitespace` in `.gitattributes` so git never
  "fixes" hashed bytes.
- Keep owner-reported, inspected, catalogue and inferred facts separate and labeled.
  Owner decisions are retained verbatim in a file.
- Record each independent check's exit status before summarizing a batch. A successful
  final command does not prove earlier checks passed; use fail-fast capture or inspect
  every result. The [D1 retained size log](../evidence/2026-10-06-d1-ferry-isle/d1-final-size.log)
  contained three failures that its initial summary mistakenly called green.
- A README that claims a retained result must name a file present and hashed at the frozen
  head, with counts recomputed from that file. Claimed raw evidence was absent at review
  (C4-R3), and a focused count disagreed with its log (E1-C6-1); the reviewer verifies the
  hashes and recounts before approving
  ([C4 primary review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-c4-hound-behavior-primary-review.md)).
- `redact()` misses escaped and nested copies: a private temporary path survived inside a
  JSON-escaped assertion message while the stack paths around it were cleaned, and a capture
  path and a scratch-worktree path reached committed records twice more. Redact after
  unescaping, and give each capture script a red control that plants a nested path
  ([docs audit DOC-E3-01](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-chapter-one-docs-audit.md)).
