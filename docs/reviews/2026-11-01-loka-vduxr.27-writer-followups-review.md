# Review: writer follow-ups, PR #568 (loka-vduxr.27, .22, .28)

- PR [#568](https://github.com/lorecrafting/lokacore/pull/568) `tools/writer-followups` at `ef679cfbf4a1c945219130e203bdb2a1e0c8a5cf`.
- Governing: [mechanics.md Branching dialogue](../system/mechanics.md), [cartridge.md compiler diagnostics](../system/cartridge.md), [book-ui.md Unavailable actions](../system/book-ui.md), [contracts lessons](../lessons/contracts.md). Changes `protocol/cartridge.schema.json` (diagnostic codes, descriptions only).
- Reviewer: independent; authored none of the work.
- **Verdict: APPROVE WITH NOTES.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success. `bin/mutate_diff.sh` not rerun.

## Must be true

1. `ALLY_ENGAGE_UNUSED` is true: an ally never engages, so its engage line never plays.
2. `ENTRY_GUESSED` pooling matches TS `spokenBy`: entries seeded first, then what failed ones lead to freely.
3. The schema code list holds the new code and the warning list; no artifact or hash change.
4. `author.sh` red controls and the Why-wait extraction tests are real.
5. New warnings do not over-fire on samplers.

## Checks that held

- (1) `hostileAt` (`kernel/ts/src/mechanics/disposition.ts:126`) needs `attackable`, which excludes allies (`combat/shared.ts:33`).
- (2) Elixir `seen` mirrors TS `tried`; the shared `test/fixtures/dialogue_entry_cases.json` cases pass in both kernels.
- (3) `protocol/cartridge.schema.json` lists `ALLY_ENGAGE_UNUSED` and the warnings; the diff touches no fixture or hash file.
- (4) `bin/author_red_controls.sh` passes; dialogue, fall-through, targets, unattackable and links tests pass.
- (5) All 107 `cartridges/*` compile with no `ALLY_ENGAGE_UNUSED` or `ENTRY_GUESSED` warning.

## Findings

**nit** `kernel/ts/test/author_trace.test.ts:25`: "the cleared timer must not fire a rejection" cannot fail; a rejection after resolve is a no-op. Mutant removing `clearTimeout` in `tools/author-panel/src/ask_trace.ts`: both tests stay green.

**nit** `tools/author-panel/src/ask_trace.ts` (`ms`): mutant 5001 ms makes the suite hang rather than fail (red only by timeout).

## Developer dispositions

- `dialogue_links.ex:132` no case: agree. `:141` subsumed by pooling: agree. `fall_through.ts:31` no change: agree. `selection.ts:173` guard kept: agree (a mutant showed no test proves it redundant).
