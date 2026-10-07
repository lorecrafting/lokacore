# E1 independent bleed job replay correction

Base: published `main` at `747c252dc25b37046d482c4a51493d16d70e0378`.
Governing clause: [C5 composition](../../system/protocol.md#c5-bleed-and-bandage-composition).

An independently replayed accepted v042 `elapsed` command from 67950 to 68100
scheduled a bleed job for body `7b36b7af-0a52-8159-9658-4542aaf05bfe`, generation 1,
due at 68200. The actual composer retained both provenance fields. The baseline
`encountersHold` rejected that result and accepted the same result after those
fields were deleted. Replaying the captured World through real `stepElapsed`
at revision 7 reproduced the accepted decision and literal composer result.
With the correction, the same real result passes and the omitted-provenance
counterfeit fails. This is a simulator oracle correction; runtime rules and
frozen fixtures are unchanged.

The regression uses the frozen `bound-bleed-job` case from
`protocol/fixtures/bleed_composition.json`. It separately checks exact scheduled
row provenance, refusal of unbound/partial/mixed schedules with counterfeit
success rows, and cancellation only of the exact pending body/generation.

## Controlled checks

- Published baseline: existing encounter/bleed composition tests passed 8/8
  ([existing-focused.log](existing-focused.log), exit 0).
- The three new tests failed against the baseline oracle
  ([first-old-red.log](first-old-red.log), exit 1).
- Corrected focused suite passed 11/11
  ([corrected-focused.log](corrected-focused.log), exit 0).
- Each of six planted mutations left the old focused suite green and failed a
  new regression: omitted schedule provenance, nonbleed job kind, mixed schedule,
  ignored cancellation body, ignored cancellation generation and mixed cancellation
  ([mutation-controls.log](mutation-controls.log)). All mutations were restored.
- `npm run typecheck` in `kernel/ts`, changed-file `check_ts_size.mjs`, and
  `git diff --check` passed. The shared full local gate is pending the PM's
  serialized slot; this record claims focused verification only.

Logs redact machine paths. [SHA256SUMS](SHA256SUMS) and
[hash-verify.txt](hash-verify.txt) retain successful verification of their bytes.

Self-review found no correctness issue in the actual diff. The existing job replay
remains independent of `composeJob`; both bleed fields are kept together, and all
other schedule/cancel branches retain their existing behavior. Ponytail Review:
lean already; no new dependency or runtime abstraction. Independent review is pending.
