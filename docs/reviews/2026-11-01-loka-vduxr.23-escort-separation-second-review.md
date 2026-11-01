# Second opinion: escort separation, PR #555 (loka-vduxr.23, kernel_api 1.137)

- PR [#555](https://github.com/lorecrafting/lokacore/pull/555) `engine/escort-separation` at `8348092a3fd78a8bcace47470ad079a4562be819`.
- Governing: `br show loka-vduxr.23`, [storage lessons](../lessons/storage.md) (Recovery and retry, #544 rule), [escort recovery](../system/save.md#escort-and-alternate-return-recovery), [escort@1](../system/mechanics.md#escort1).
- Reviewer: independent; authored none of the work. View formed before reading any record.
- **Verdict: CHANGES REQUIRED.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success.

## Must be true

1. No state accepted commands reach, with an escort in any phase, gives `save_corrupt` on reopen or a permanent kernel throw. **Fails, blocker 1.**
2. A following escort is separated in the same decision by NPC death, departure or quest end; only Rejoin returns it. Holds.
3. Content with no escort: receipts unchanged. Holds; no group or op, and `reactions_sampler`, `permanent_tick` pass.
4. Reopen matches the session and the row binds to its receipt. Holds, apart from blocker 1.
5. A forged row is refused, or if loaded neither throws at launch nor persists corruption. Holds for identity and receipt forgeries; **see blocker 2** for the quest row beside a completed one.
6. Old saves get an explicit pin refusal. Holds: every story diff is `kernel_api` 1.136 to 1.137 in the pin; `release_pin` passes.

## Findings

**blocker 1** `mobile/authority/local-story/escort-save.ts:48` (`original()`, `:84-88`) with `kernel/ts/src/mechanics/quest/lifecycle.ts:120`, and `lib/loka/content/escort.ex:23`. A lawful save is refused for good.
Reproduced at this head with real saves: an escort `start` on a no-quest dialogue naming a repeatable exchange quest; accept, start, walk home, exchange turn-in (the sweep separates; reopen fine), re-accept. That decision's `quest.retire` deletes the quest row the escort row names; every command was accepted, the live session plays on (Rejoin refused `invalid_state`), and the next reopen throws `save_corrupt` on every launch.
The compiler accepts this shape: `Source.compile` gave `{:ok, _, []}` for the `repeatable: true` exchange quest with a `dialogues/healer_walk.json` escort start. `lib/loka/content/exchanges.ex:162` forbids `escort` only on the exchange's own dialogue. This is the PR's Open line "Not reproduced here"; it is now reproduced, and the bead's title and the #544 rule cover it. No shipped cartridge has escort content (`git grep -l escort -- cartridges` is empty), so nothing bricks today. By reading only, not run: main bricks earlier, at the turn-in.
Fix, either: compiler refuses an escort naming a repeatable quest (`escort.ex`, one clause and a refusal test), or `escort-save` and the kernel accept a retired quest row. Add the reopen case.

**blocker 2** `mobile/authority/local-story/escort-save.ts:96-106` (`terminal()`). Step 3: a green suite. `:96` is this PR's line. Each of these stays green on `escort.test.ts`, `kernel/ts/test/escort.test.ts`, `reactions_sampler`, `branching_forged`, `branching_reload`: `:96` to a bare `return;`; dropping `completed.length !== 1`; dropping `quest.state !== 'resolved'`; `quest.outcome` check to `false`. The forged-completed case (`escort.test.ts:571`) only reaches `latest()`. Scenario: a regression disables `terminal()`, and a forged quest row beside a completed escort loads while no test fails. Add one forged quest row red control ([storage lessons](../lessons/storage.md): each linked field), or delete `terminal()` if `latest()` is meant to be enough.

**nit** `kernel/ts/src/runtime/proposal.ts:120`. Dropping `if (!held.length) return;` survives: receipts do not change, but a no-escort decision then composes `now(p)` on every command for nothing. Only a timing test could see it; recorded only.

**nit** PR body Open cites `shared.ts:212` for "Rejoin refuses": that line closes `partings`. The refusal is in `refused()` at `shared.ts:58-83`. Other cites rerun and hold: `escort-save.ts:96`, `quest/lifecycle.ts:120`.

**nit** PR body: `/code-review medium` ran at `7f5387da5`; fixes through this head were not re-reviewed.

## Checked and fine

- Reload at each stage, each reopened and moved on: deadline failure in pulse catch-up beside a following row; lost COMMIT on the sweeping Move; `npc.move` holds following; completed then plain re-accept (no retire, two rows); forged mortal hp row refused at load, no launch throw.
- #544: no check removed here should stay; `escort-save.ts:44-45` survives because an NPC only ever transfers between rooms and entities are never deleted (read).
- #535: permanent saturated `hungry` beside a deadline, 100 hours by pulse: tick folded, quest failed, escort separated, two reopens OK. Fold and sweep landed in separate receipts, so same-decision interplay is reasoned: the sweep reads the final state after `jobs(p)`.
- Forged quest state: `failed` beside no escort row also opens, so the sweep signing a separated receipt on such a row is no new class of acceptance.
- Elixir: `compose_escort.ex` and `invariants_escort.ex` already allow following to separated; the story rule is TypeScript-only, no differential.
- `size: allow 610`: agreed; the file is 602 lines on one `setup()`.
- `reactions_sampler` fixture edit: justified, the sweep now reads a whole row. Composition record present.

## Mutants

Null control (comment) SURVIVED. Hand mutants, red: drop `?? parting(p)`; `held` empty; `held` inverted; `parted()` quest clause narrowed, off, each flip; `living` off; co-location off and flipped; `partings` status guard off; `separate` empty; `shared.ts:175`; `latest()` removed, `!same` off, revision order swapped; `:96` inverted. `bin/mutate_diff.sh origin/main` under `MUTATE_MINUTES=15`, exit 1: 5 SURVIVED (one hop; `shared.ts:123,125` cleared by the hand mutants above, `:136` not rerun), 14 TIMEBOX, 1 NOT-UNIQUE (`proposal.ts:122`); those rows not hand-run stay unrun.
