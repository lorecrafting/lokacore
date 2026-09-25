# Evidence lessons

Hard-won lessons for evidence capture and privacy.

**Evidence and privacy**
- Retained raw tool output is hashed (`SHA256SUMS` with its verify output beside it,
  not self-listed). Mark evidence folders `-whitespace` in `.gitattributes` so git never
  "fixes" hashed bytes.
- Keep owner-reported, inspected, catalogue and inferred facts separate and labeled.
  Owner decisions are retained verbatim in a file.
