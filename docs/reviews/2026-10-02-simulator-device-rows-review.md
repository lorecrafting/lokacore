# Review: owner decision on Simulator device rows — 2026-10-02

PR #122 (`simulator-device-rows`), commit reviewed `fcd5f65`. Docs only; no tests to break.

**Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. The record, `docs/system/owner-rules.md`, `docs/lessons/mobile.md` and the decisions index give the same rule: a slice's automated device rows on the iOS Simulator; the iPhone 11 at gates, before a release, and for native, performance or touch changes.
2. No live doc (docs/system, WORKFLOW, lessons, AGENTS.md, CHECKS, ROADMAP) still requires the phone for every slice's rows.
3. The parity claim ("same Hermes and expo-sqlite, arm64 on the M1") holds for the build the Simulator rows use.

## Checks

- The four files agree on the three phone cases. Index line `docs/decisions/README.md:92` matches the record title.
- `git grep -i 'phone|device|iphone'` over AGENTS.md, WORKFLOW, docs/system, docs/lessons, CHECKS, ROADMAP: no per-slice phone requirement. `CHECKS.md:63` and `owner-rules.md:15` state history and the one-phone rule; both are consistent.
- arm64: correct, the Simulator on Apple silicon runs arm64 slices. expo-sqlite bundles its own SQLite, so the same SQLite code runs.

## Findings

- **should-fix F-1** `docs/decisions/owner-decision-simulator-device-rows-2026-10-02.md:8`: "the same Hermes" holds only for a Release build. The phone rows ran a Release build with Hermes bytecode and the debugger off (`docs/evidence/2026-10-02-r6p-savefix-iphone11/README.md:25,29`). The Simulator walk in `docs/lessons/mobile.md` uses a dev build. Failure scenario: a slice runs the Node/Hermes byte compare on a Simulator dev build. Hermes then runs the Metro source and skips the hermesc bytecode step, so a divergence from the bytecode compile passes on the Simulator. Fix: require a Release Simulator build for the rows, or narrow the claim to "the same Hermes and expo-sqlite versions".
- **nit N-1** same file `:13`: "The M1 phone run". M1 means the owner's Mac (`:9`, `AGENTS.md:146`) and also a roadmap milestone (`docs/ROADMAP.md:23`). Name which one.
- **nit N-2** `docs/lessons/mobile.md:31-32` repeats the rule in `owner-rules.md:127`. A link alone would state the fact once.

## Fix round 1 — `551a3ca`

**Verdict: APPROVE**

- F-1 fixed: record `:8-10` requires a Release Simulator build (Hermes bytecode, as on the phone) and narrows the claim to the same Hermes and expo-sqlite versions, arm64 on the M1 Mac.
- N-1 fixed: `:14` names the Quest from dialogue slice (M1), which matches `docs/ROADMAP.md:23`.
- N-2 fixed: `docs/lessons/mobile.md:31` now links the owner rule. Note, not blocking: that line says "Release", and `owner-rules.md:127` does not. The rule links the record, so a reader still reaches the Release requirement.
