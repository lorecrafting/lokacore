# E1 legal Night route independent review

**APPROVE** the bounded, unregistered Night route proof at exact head `7664e4c5266ca4ae2102739d37cfea030ac3316b` against `8e1ea253db9f777f6ef7c05ad771833fb5a2fb74`; author source `b47d3852198e1949de7c51b02f10576aa9dd7122`. Fresh independent reviewer; no findings. No PR number was supplied. Registration and E1 certification remain pending.

## Requirements derived before diff

[Mechanics C6 S27](../system/mechanics.md#c6-s27-night-in-the-marsh-selected-planning-contract) and the [cartridge S27 declarations](../system/cartridge.md#c6-s27-expedition-declarations) require a deliberate living-player Start at Hound Run, cursor zero, legal hound/Flee interaction, precisely five accepted player edges, optional cursor-three shelter without time advance, and one atomic completion with the same quest/attempt, survival true and Priory/Fen −1. A later Start must refuse without another reward. The [E1 exact-candidate policy](../system/architecture.md#e1-exact-candidate-proof-policy) and [brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md) require fresh real-authority/SQLite receipts, cold reopen before consumers, literal oracles, deterministic per-step checks/replay and source/evidence binding. Unregistered recipes cannot certify E1.

## Independent checks

- `mise exec -- node --test kernel/ts/test/e1_cases.test.ts kernel/ts/test/e1_watch_rounds.test.ts kernel/ts/test/e1_night_marsh.test.ts`: exit 0, four tests. `mise exec -- npm run typecheck` in the kernel package and focused Prettier check: exit 0. `git diff --check`: exit 0.
- Fifth-entry mutant omitted only the final Move: old cases/watch exit 0; new Night exit 1, observing Willow Shade instead of literal Reed Bank. Shelter mutant omitted only Use: old cases/watch exit 0; new Night exit 1, observing `sheltered: false` instead of true. Both mutations were restored.
- All ten new and eleven original evidence hashes verify. Retained recipe/test digests equal reviewed bytes; author source is an ancestor of the reviewed head, with only documentation after it. Old failure evidence is unchanged against the review base.
- Independently reconstructed the admitted fresh world, checked each retained initial-state hash, and replayed all commands through `AUTHORITY_KERNEL`: Night 15, watch 31 and original blocked Start 5, each passes at the published-fix source. The original `a1322ea` receipt still records `delta_preconditions_hold` at command index 4; this is a new-source comparison, not a rewritten old answer.
- Night records ten cold reopens. The route asserts cursors 0–5, preserved occurrence/attempt, optional shelter and clock, terminal fact/faction/quest, and refused repeat Start. The existing case host observes real SQLite receipts and compares each committed decision/state with per-step `checked` output. No production, loader, checker or recorder code changed. Evidence contains no private-path or device-identifier token.

Ponytail Review: Lean already. Ship. The recipe reuses the existing case host and replay; no new abstraction or dependency. Correctness self-review found no in-scope failure.

This approval covers the selected legal success/Flee/shelter/once route and the watch rerun only. Footprint failure, death/Restart, fault schedules, exact authored-obligation registration and final E1 source-bound gate remain separate. The shelter path does not establish a damaged-player healing boundary.
