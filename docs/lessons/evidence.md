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
