# Evidence lessons

Hard-won lessons for evidence capture and privacy, moved verbatim from AGENTS.md.

**Evidence and privacy**
- Never print or commit adb serials, iPhone UDID/ECID/serial/device name, team ID,
  certificate or provisioning identifiers, home/scratch/worktree paths or
  app-container UUIDs. Every capture script has a `redact()` covering them.
- Retained raw tool output is hashed (`SHA256SUMS` with its verify output beside it,
  not self-listed). Mark evidence folders `-whitespace` in `.gitattributes` so git never
  "fixes" hashed bytes.
- Keep owner-reported, inspected, catalogue and inferred facts separate and labeled.
  Nothing invented; unknowns stay null. Owner decisions are retained verbatim in a file.
- Declare any performance variant before tuning it, and keep failing results.
