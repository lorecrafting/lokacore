# Branching dialogue engine, second opinion on save behaviour (loka-vduxr.10)

[PR #544](https://github.com/lorecrafting/lokacore/pull/544), branch `engine/branching-dialogue`, commit
`34700e6ac3d17b2ab5c1fcebae51ad4cf5651537`. CI by `gh run list --commit`: ci, book-e2e, graph-diff all completed success.

Governing: [dialogue, branching](../system/mechanics.md#branching-dialogue), [storage lessons](../lessons/storage.md), [Review count](../WORKFLOW.md#review-count), `br show loka-vduxr.10`. PM ruling taken as given: a forged custody move may load, because a lawful save outranks catching forgery.

**Verdict: APPROVE WITH NOTES.** No regression against main: every refusal below also reproduces with main's `dialogue-save.ts` swapped in, and no shipped cartridge has a dialogue-received item with `give_allowed: false`. S1 and S2 are permanent save bricks a writer can compile, so fix them or file them as Beads before anyone writes a one-way restricted item.

## Must be true (written before reading the diff)

1. Every lawful sequence of commands reopens without refusal, with the same view and continuation. **Fails: S1, S2, S3, N1.**
2. With the new fields absent, artifact, decisions and receipts are byte-identical; showcase frozen. Holds.
3. No new refusal reachable by lawful play relative to main. Holds.
4. `choose` and the view share refusals; reload keeps a child row (`beat === d.key`, full `choice_ids`, `openable`). Holds.
5. Receipts accept reply variants and narrate steps. Holds.
6. A loaded forgery neither throws on every launch nor persists corruption. Holds.
7. Refusals and warnings are in plain words. **Fails for reload refusals: S1.**

## Findings

All lawful play, compiled content, refused at cold reopen as `save_corrupt` for good.

**S1 should-fix, `mobile/authority/local-story/dialogue-save.ts:66` and `:266`.** A killable NPC breaks the "one history" the comment at `:21-23` assumes. One receive, no way back, `give_allowed: false`: (a) the giver dies before the take, the token moves to the corpse, `holder !== original` refuses; (b) delivered, then the destination dies, `containers[item] !== destination` refuses. This is the simplest courier shape, so a real writer would trip on it. `oneWayStarts` gives no compile diagnostic or warning, and the only signal is `malformed JSON: inconsistent bound item return` (`:18`).

**S2 should-fix, `dialogue-save.ts:78` via `:41`, pinned by `branching_forged.test.ts:130`.** An edible restricted item taken and eaten has no `containers` row, so `npcHolds` refuses, one-way or two-way. The test pins a deleted row as refused, which is the same state as eating it.

**S3 should-fix, `dialogue-save.ts:232`.** Plain answer `give` (no `hand_over`) on the same quest as a hand-over answer also named `give`, in another dialogue. Taking the plain one resolves the quest with outcome `give`; no row exists for the hand-over dialogue, so `:232-233` refuses. A differently named answer loads (fixed here, refused on main). New code, small fix: look for the answer across the quest's dialogues.

**S4 should-fix, PR body "Fix round 2".** It says forged facts, holders and terminal quest rows now load and `message.test.ts` refusals moved. Not at this head: `message.test.ts` is not in the diff, dropping `:210` turns it red, `branching_forged.test.ts:94-134` refuses them, and `8ed2c4ee9`, `484c7f4f6`, `34700e6ac` restored them with no body report. A later reader takes the wrong save contract from it.

**N1 nit, `mobile/authority/local-story/dialogue-consequences.ts:41-71`.** `matching.length !== 1` refuses two writes of one fact on a moving answer (`steps: [flag(true), flag(false)]`; assign plus adjust). Compiles, plays, refused at reopen. Same on main. Odd authoring.

**N2 nit, `mobile/authority/local-story/branching_reload.test.ts:238`.** `assert.throws` has no pattern, so a TypeError passes; `refused` uses `/save_corrupt/`.

**Question, `dialogue-save.ts:206`, `:210`.** `factWriters` counts steps only. Non-step writers (`patrol/sequence.ts:223`, `scene/rest.ts:45`, `trail.ts:92`, `death/sequence.ts:231`, `combat/credit.ts:43`) could change a "one writer" fact and be refused? Main refuses too. Not probed.

## Probes that hold

Reopen passes: restricted item dropped (two-way); take and give by different facts; narrate on take and give; each stage of a talk; skill plus narrate; one-way quest hand-over with variants; `then` into a quest offer; two-way giver killed untaken; `once` take then `stay` with the speaker killed; taken, handed back, giver dead; one-way taken then giver dead; two-way destination dead; pending row then walking away; pending row with all options hidden; escort with narrate, variant and `then: end`. Check plus receive is refused at compile.

Forgery (ruling): forged holder and forged two-way item open, the answer is `not_owned`, reopen is fine; the `survives` tests agree.

Old saves: `authority.ts:97-98` pins `kernel_api` equality (head `1.132`), so a pre-PR save is `pinned_release_missing`, plain, not corrupt.

Receipts: keys only widen with variants (`dialogue-receipt.ts:82-85`), narrate skip applies only to narrate steps, protocol fixtures additions only.

#535 and #541: head merged with `3a5e1f498` (`7b1530acc`), `branching_reload`, `branching_forged`, `escort.test`, `open_catch_up.test` green. Neither touches choice rows; no interaction found.

## Test the tests

Narrow mutants on `dialogue-save.ts` against `branching_reload`, `branching_forged`, `escort.test`, `message.test`, `gift.test`. Null control 75 pass, 0 fail.

| Mutant | Red tests |
| --- | --- |
| `:41` dropped | 1 |
| `:130` `!== 1` to `> 2` | 1 |
| `:130` `given.some` dropped | 1 |
| `:132` always received | 1 |
| `:206` `!== 1` to `< 1` | 3 |
| `:37` `if (false)` | 2 |
| `:57` dropped | 1 |
| `:66` dropped | 1 |
| `:68` dropped | 3 |
| `:210` dropped | 4 |

`received.length > 1` stayed green and is equivalent: a custody item always has one receive. `bin/mutate_diff.sh` and a full sweep not run, per the brief (narrow mutants only).

## PR claims rerun

- Showcase diff against main empty: backed.
- "Fix round 2" reload claim: not backed (S4).
- `/code-review` reported at `1fbc8ccdd`, older than this head.

## Disposition

None yet; second opinion on this head.
