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

## Fix re-check at `82e8c0a1deeb2bf7be9a7ef7962419748cb011ff`

CI by `gh run list --commit`: ci, book-e2e, graph-diff completed success. PM ruling for this round: S1-S3 and N1 are fixed here by deleting inferred custody checks; a forged custody move may load, but must not throw every launch or persist corruption.

**Verdict: CHANGES REQUIRED** on F1 alone: the PM ruled N1 fixed in this PR, and part of it stays open and bricks a lawful save. F1 alone would be should-fix by severity; the ruling makes it required here.

### Disposition

| First round | Now | Proof (cold reopen; rows, receipts and state identical) |
|---|---|---|
| S1 dead giver before the take | closed | probe passes |
| S2 dead destination after delivery | closed | probe passes |
| S3 restricted item eaten | closed | probe passes |
| Plain answer sharing the hand-over id | closed | probe passes |
| Courier shape, both NPCs killed | closed | probe passes |
| N1 two writes of one fact | **part open** | `[flag(true), flag(false)]` and two adjusts pass; assign plus adjust refused, F1 |
| N2 `assert.throws` with no pattern | closed | `branching_reload.test.ts:238` now has `/save_corrupt/` |
| S4 reload claim | closed | not in the PR body |

### Findings

**F1 should-fix, `mobile/authority/local-story/dialogue-consequences.ts:56-59`, `:79`.** A moving answer (`take`) with `[fact.assign count=1, fact.adjust +1]` or `[fact.adjust +1, fact.assign 5]` compiles and plays, then is `save_corrupt` at every later launch. The `writers` filter counts assign writers only (`assignmentOf` returns undefined for `fact.adjust`), so one assign looks like the fact's only writer, and its value is compared with the state the adjust moved. Count `fact.adjust` as a writer of its fact. Same on main. The PR body's "infers nothing about who wrote a fact" holds for `dialogue-save.ts`, not for this check it reaches through `committedDialogue`.

**F2 should-fix, here or in Beads at the PM's choice, `mobile/authority/local-story/escort-save.ts:46`, `:127`.** Same class as S1 and S2, in the file this PR trimmed and listed as "not probed". The compiler accepts it: `ferry_sampler` with an escort start, `bram` given hp and attack, and combat and death settings compiled with no diagnostics. The save probes used a compiled cartridge edited to give the NPCs hp and attack: completed escort then speaker killed; completed then child killed; following then child killed. Each is a lawful kill, then `save_corrupt` for good; the same run with no death reopens. Lines are unchanged from the merge base, so deletion did not open it. I found no shipped content with such an NPC by grep. #550 (open) gives authors a way out, not a guard.

**N3 nit, `mobile/authority/local-story/dialogue-save.ts:34`.** The comment says a holder cycle cannot be left to play on; `holderLoop` walks custody items only. A self-held non-custody container, in a cart with custody dialogue, hangs at first open in `kernel/ts/src/view/view.ts:210`, an unguarded walk. Forged only. `view.ts` is unchanged and the base walked only custody holders, so pre-existing by read, not run on base. Narrow the comment, or walk every item.

**N4 nit, `mobile/authority/local-story/dialogue-save.ts:23`.** Dropping `!escortChoices` from the early return stays green against `branching_forged.test.ts` and `escort.test.ts` (43 pass): a forged resolved escort row in a cart with escort answers, no custody and no relation loads. Forged only, so allowed by the ruling; the clause could go, or get a pin. Present before this round.

**N5 nit.** `/code-review` is reported at `1fbc8ccdd`, older than this head.

### Hunt: what deletion could have opened

- Lawful repeat writes reopen: fact set first then a moving answer sets it or flips it; topic known before a moving grant.
- Forged states, none persists a throw after play: custody loop through another item and body held by a custody item are refused at open; forged fact after a moving grant, custody item in a missing holder, its row deleted, or forged back to the giver and taken again all load, play and reopen. A hand-inserted fact row was refused at first open; its key was probably malformed, so not judged further. Only the N3 hang is worse than a refusal.
- Old saves: other `kernel_api` gives `pinned_release_missing` (`authority.ts`); bump to `1.135` at `kernel/ts/src/runtime/world.ts:108`. Read, not run.
- #535 fold: `permanent_tick.test.ts`, `status`, `npc_status`, `derived_status` green. #541 job refusal: dropping `jobSave` turns `open_catch_up` red on the due, hour and kind cases.
- Topic content: `priory`, `hidden_skill`, `riddle` green with `topics-save.ts` gone.

### Mutants

Null control: `branching_lawful, branching_forged, branching_reload, message, escort, open_catch_up, gift` 107 pass.

| Mutant | Result |
|---|---|
| `holderLoop` returns false | `branching_forged.test.ts` hangs, killed at 90 s; caught, not by an assertion |
| drop `if (writers.length > 1) continue` | red `a moving answer writing one fact twice reopens` |
| skip the `movesItem` receipt check | red two tests: item set back to active, resolved take or give with no receipt |
| drop `jobSave` in `receipt-save.ts` | `open_catch_up` red, three job cases |
| drop `!Object.keys(escorts)` clause | red `an escort row in a world with no escort answer is refused` |
| drop `!escortChoices` clause | green, N4 |

### PR claims rerun

- `scavenge_item?` refuses Give-restricted items: backed, `lib/loka/content/population.ex:195`, `:247-250`, by read.
- "the escort clause red only after the new pin": backed for the `escorts` clause (table); the `escortChoices` clause survives.

Not run: the cycle on base; a reaction writing the same fact as the answer; Elixir tests.
