# E1 encounter/bleed oracle independent review

- Local source branch: `fix/e1-encounter-bleed-provenance`.
- Source reviewed: `5640ff83e919151e88d0a78a61d99c1922395b66`.
- Base: `747c252dc25b37046d482c4a51493d16d70e0378`.
- Fresh independent reviewer; authored none of the implementation.
- Verdict: **CHANGES REQUIRED**. One should-fix test finding; no source correctness finding.

## Required behavior

Derived before reading the source diff from [C5 mechanics](../system/mechanics.md#c5-hound-bleeding-and-bandage-selected-contract), [C5 composition](../system/protocol.md#c5-bleed-and-bandage-composition) and [invariants](../system/protocol.md#invariants): lawful round-produced schedules, tick completion and exact cure cancellation preserve body/generation; partial or mixed bindings and forged results refuse; runtime, save and frozen fixture guards remain intact. The independent replay must not delegate its answer to the production composer. [Test discipline](../../AGENTS.md#writing-tests-every-change-every-agent) requires a realistic guard mutation to fail a focused check.

## Finding

**E1-R1 — should-fix — `kernel/ts/test/encounter_bleed_jobs.test.ts:55`.**
The mixed-schedule negative cases copy forbidden fields into the counterfeit result. For a lone `water_body_id`, the replay never copies that field, so row inequality rejects the result even if the exclusivity guard is missing. Independently deleting only `op.water_body_id` at `kernel/ts/src/runtime/invariants_encounter.ts:229` leaves all 11 focused tests green. With that mutant, `{...boundSchedule, water_body_id: boundSchedule.bleed_body_id}` and the frozen `bound-bleed-job` expected result wrongly return `true`; the reviewed source correctly returns `false`. This is the explicitly required lone-water-body refusal, concealed by an unrelated assertion mismatch.

Disposition required: adapt the existing negative case to assert refusal with the canonical bleed result (the row the replay would actually build), and show the one-line guard deletion failing that test. No additional production abstraction or overlapping test is needed. Review the same masking risk for forbidden fields the replay omits.

## Independent verification

- Retained [evidence](../evidence/2026-10-06-encounter-bleed-oracle/README.md): all four SHA256 entries verified; evidence files retain `-whitespace`.
- Reproduced baseline old suite 8/8 green and new suite red. Reproduced six documented classes: omitted provenance, nonbleed kind, mixed encounter schedule, ignored cancellation body, ignored cancellation generation and mixed water cancellation. Each leaves the original suite green and fails a new test. The additional lone-water-body mutant survives 11/11 as described above. All mutations were in a disposable detached worktree, restored and removed.
- Restored `mise exec -- node --test --test-reporter=spec` over `encounter_composition`, `bleed_composition`, `encounter_bleed_jobs`, `c5_bleed`, `c5_bleed_death` and `c5_bleed_early_expiry`: **25/25 pass**, exit 0.
- Controlled actual `step`/`stepElapsed` using the existing C5 fixture: attack, positive hound round/bleed schedule, tick completion/successor and qualified in-combat bandage cancellation are accepted. `encountersHold(base(before), delta.ops, actual adopted job/encounter rows)` passes each. These checks compare the independently replayed result with the runtime's actual adopted row values.
- Diff changes no runtime composer, save loader, schema or frozen fixture. Wrong result body/generation, partial bindings, nonbleed kind and mixed discriminator cases refuse in the new tests. Existing foreign-writer composition controls pass.
- Ponytail Review: lean already; no new dependency or runtime abstraction. The three new tests address distinct replay gaps absent from the original eight; E1-R1 concerns how one negative input proves its guard.
- Full local gate deliberately not run: another branch owns the serialized slot. This record claims focused verification only.

## Scoped fix review — E1-R1 closed

- Fix source: `e6b213617ed63b3547c921189146388017af6c53`, parent `5640ff83e919151e88d0a78a61d99c1922395b66`.
- Verdict: **APPROVE**. E1-R1 closed; no open findings.
- The existing negative test now supplies the frozen canonical bleed result for lone water-body, standalone actor and orphan crow generation/phase bindings. These fields are omitted by replay, so rejection must come from binding validation. No production source changes; the added inputs cover the same masking risk without adding an overlapping test or helper.
- Independently removed each of the four individual fields from `bleedBindingValid` in a disposable detached fix worktree. Every mutant failed the corrected invalid-schedule regression with `true !== false`, exit 1. Restored new tests passed 3/3; restored encounter/bleed composition plus replay tests passed 11/11, exit 0. The disposable worktree was restored and removed.
- All eight retained evidence hashes verified. Scope was the fix diff, E1-R1 disposition and affected test/guard controls; no broad gate rerun. Ponytail Review: lean already.
