# Dialogue sitting and end_talk contract: second review

PR #576, `engine/dialogue-sitting`, commit `8c413c8c34cbf36c9287c0e6bb3dea162de40c4b`, Beads `loka-vduxr.11`. Scope by brief: schema, saves, `proposal_farewell.ts`, `kernel_api`. Written without reading the first reviewer's record.

Governing: [reopen principle](../lessons/storage.md) (lines 41-45), [`docs/system/save.md`](../system/save.md) (pin, lines 19-25), `docs/system/mechanics.md:499`, `docs/system/cartridge.md:272`.

## Must be true (written before the diff)

1. Schema additions are additive; existing cartridges compile and hash unchanged.
2. Elixir refusals of `sitting` match where the TS `hub` reopens.
3. Every state accepted commands reach reopens through `openGame`, without replay.
4. A stale `choice_ids` row cannot cross a release.
5. `end_talk` never faults the player's action.
6. `closedByOpener` changes nothing for existing cartridges.
7. `SITTING_SPENT` is a warning; the refusals are errors.
8. Generated files are current; `kernel_api` is main+1.

## Findings

**Blocker 1: `end_talk` on `choice_opened` loses the save.** `lib/loka/content/reactions.ex:136` admits the event and `docs/system/cartridge.md:272` documents it. Compiled `persuade_sampler` plus `{on: {event: choice_opened}, steps: [{op: end_talk}]}`: `talk` is accepted, the row opens and closes in one decision, and the next `coldReopen` throws `save_corrupt` from `selectorSave`, at `mobile/authority/local-story/riddle-save.ts:102-104` (it refuses a close of the row the talk opened; raised at `:119`). The check runs for every cartridge and #574 keeps it. An accepted command reaches a save refused for good, against storage.md:41-45. Fix: let the evidence accept the own close, or drop the event from `@own_acts` and the doc.

**Blocker 2: `end_talk` from another command closes a bounded riddle and loses the save.** Riddle fragment plus `{on: {event: action_completed}, steps: [{op: end_talk}]}`: open the riddle, run `coil_rope`; accepted with `choice.close`. `coldReopen` throws `save_corrupt` at `riddle-save.ts:158` (`answerEvidence`'s `else`, reached through `attempts`). Controls: a `narrate` step instead reopens; without `wrong_limit` reopens, so the hole is bounded riddles only. Fix: any accepted receipt with this close counts as closing. This run used a hand-built bundle; compiler acceptance is by reading `reactions.ex:136`; `grep end_talk lib/` shows no other refusal.

Blockers 1 and 2 share a test gap: `kernel/ts/test/dialogue_sitting.test.ts` uses `checkRow` and an in-memory `reload`, which skip `selectorSave` and `riddleSave`. The fix needs a `coldReopen` test (`storage.md:29`) for each.

**Blocker 3: the riddle arm of the `sitting` refusal is untested.** `lib/loka/content/hub.ex:60`: replacing `d["riddle"]` with `nil` leaves `content_dialogue_sitting_test.exs` and the riddle-limit, rest, group and fixture-contract tests green (35 passed). Not equivalent, by compile: `guard.json` with an unbounded riddle, no quest, choices `a` and sitting `b` is refused at head and compiles `{:ok, []}` under the mutant, so `sitting` there is silently ignored. Blocker by the review rule on green suites; one list entry fixes it.

**Nit: PR body line 1** says `kernel_api` 1.146 to 1.147; `kernel/ts/src/runtime/world.ts:110` and body line 38 say 1.148.

**Nit: `lib/loka/content/reactions.ex:93`** comment says a second close would fault the action. Two `end_talk` steps in one rule are refused, but two rules on one event ran accepted with one close: the second sees it closed. The comment overstates it.

## Passing

- Mid-sitting cold open through `openGame` reopens, row `[b, z]`; `end_talk` on `choice_resolved` with sitting reopens. Stale rows: refused at the pin (`pinned_release_missing`, save.md:19-25) before any row check, so no reworded-dialogue case reaches `openable`. Nothing here needs replay.
- Additive: `git diff` deletions in `protocol/cartridge.schema.json` are descriptions and the enum's trailing comma; `cartridges`, `test/fixtures`, `protocol/fixtures` unchanged; seven story save pin lines change, as expected.
- `closedByOpener` changes only an own close of a row opened in the same proposal, which earlier faulted; `farewell` is a pure extraction. No existing cartridge has `end_talk`.
- `SITTING_SPENT` is `warning(...)`; refusals match TS `hub`/`reopens` by reading.
- `kernel_api` 1.148, main 1.147.
- Mutants, all red: `behavior.ts:106` filter dropped (2 failed), `closedByOpener` no remap (1), `openable` sitting clause (1), `reactions.ex` `@own_acts` check (1).
- Claims rerun: `dialogue_sitting.test.ts:19` cite holds; PR body line 1 does not (nit above).
- `/code-review medium` reported. CI at head by `gh run list`: ci, book-e2e, graph-diff success.

## Not checked

`bin/regen.sh` stopped locally at the story views (`react` missing from cloned deps) with no tree change before that point; story views rest on green CI. No full `bin/mutate_diff.sh`, by brief. `end_talk` on `check_passed`/`check_failed` against a bounded riddle not run. Book UI not in scope.

Round 1: changes required.

## Re-check at 53af400730c105654ef79019e626b7204aef3748

Scoped to my three blockers and `forked`. CI at this head by `gh run list`: ci, book-e2e, graph-diff success.

**Blockers 1 and 2: fixed.** `dialogue_end_talk_save.test.ts` runs each shape through `coldReopen`: end_talk on `choice_opened` (a plain talk and a bounded riddle), a second op on `choice_opened`, and end_talk on `action_completed` over a bounded riddle with a miss. The riddle helper then sends a next command, accepted; the plain-talk `choice_opened` test stops at the reopen, so it proves no next command. Scratch probes, `coldReopen` plus an accepted next command each time, no throw or hang: plain talk after `choice_opened` closes (next `talk`) or edits (next `choose`), reopened again after it; three sittings closed at open; two bounded sittings with misses, closed by `coil_rope`; a right answer with end_talk on `choice_resolved`.

Ordinary play kept: attempt count, limit close, resolved status, row and receipt agreement, quest binding, own-row `choose` actor. `kernel/ts/test/riddle.test.ts`, `dream.test.ts`, `escort_repeat.test.ts` green here; `mobile/app/book/riddle.test.ts` cannot load locally (`react` missing), rests on CI. `riddle_wrong` emits no events, so no reaction can close a row on a miss.

Mutants of `riddle-save.ts`, all red: `prior` back to `opened_revision`; other-op refusal restored; one-event check restored; non-choose closer limited to talk, continue, close_choice.

**Blocker 3: fixed.** `hub.ex` with `d["riddle"]` or `o["patrol"]` as `nil`: both red.

**Should-fix: `forked` can still double fire.** `lib/loka/content/dialogues.ex:154`, `lib/loka/content/hub.ex:103`. Both compiled, played and reopened, and reached outcomes `a` and `b`:
- A third choice with `gate_open := false`: choose a, c, b.
- Choice a with steps `[gate_open := true, gate_open := false]`: `self_gates` accepts any matching assign, not the last.

Any other writer of the fact resets it the same way. The test "a story point with no quest takes one outcome" states the rule that this breaks. No save is harmed. Remedy: take the last assign of the fact, and refuse a shared gate whose fact another step sets to another value. Single-outcome `point_refusal` shares the reset gap, and it predates this slice. That is why this does not block: `point_refusal` already accepts `self_gated?` as once for single-outcome points, and the remedy holds `forked` to that standard. Sound otherwise: a lowered `once` has its own fact and is refused; a per-subject fact read with no subject is refused (`FACT_SCOPE_UNSUPPORTED`); a step's `subject` is refused; a failed check applies no steps and no point. `forked` mutants (rule off; any gate suffices): red.

**Nit: `dialogue_end_talk_save.test.ts:161`.** The unbounded test also passes on the pre-fix `riddle-save.ts`, so its "Breaks" comment describes no regression that the fix removed.

Final verdict: APPROVE WITH NOTES
