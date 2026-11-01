# Branching dialogue engine, independent review (loka-vduxr.10 slice 1)

[PR #544](https://github.com/lorecrafting/lokacore/pull/544), branch `engine/branching-dialogue`, commit
`9fcd0e99cff64e449f23dffb8ec86b17f883df53`. CI on that sha: `ci` success, `book-e2e` success (`gh run list --commit`).

Governing: [dialogue, branching](../system/mechanics.md#branching-dialogue), [composition](../system/architecture.md#building-mechanics-by-composition), [book-ui](../system/book-ui.md), [Review count](../WORKFLOW.md#review-count), `br show loka-vduxr.10` brief and the owner's bar (quoted): "follow known patterns in Rpg dialogue", with full expressiveness.

**Verdict: CHANGES REQUIRED.** One root cause in new code (B1). The fix is verified and removes code.

## Must be true (written before reading the diff)

1. A hidden option is absent from the view; choosing it is `invalid_state`; view and choose share one rule; Talk skips a dialogue with nothing shown.
2. A hub reads the answer's own writes: nothing left ends the talk, otherwise a row with the full `choice_ids`.
3. `then` opens the child in the same decision: resolve, then open, ordered events, new continuation id, the child's prompt.
4. A `then` target is not opened by Talk and never reopens itself; an answer there without `then` ends; `then: end` ends.
5. A check takes `then` on pass and `then_failed` on fail, keeps the failure line; `then` with no check rule is refused at compile; patrol is refused.
6. Another speaker is allowed; a compile warning when elsewhere; a hostile one ends the talk.
7. Narrate step, `fact_at_least`, `narration_variants` first `when` wins.
8. Reload: no new save shape; a child row survives cold reopen; `ChoiceRow`, `openable`, GameView schema unchanged.
9. `parted` closes a one-choice child when the speaker is apart.
10. Compiler errors at paths; self-gating passes `receive`, plain stays `OUTCOME_MISMATCH`.
11. Showcase bytes unchanged; `kernel_api` 1.132; no Book code.

## Findings

**B1 blocker: `kernel/ts/src/mechanics/dialogue/behavior.ts:99-100`, `rule.ts:108-110`.** What follows an answer is read against a world that is not the one the decision leaves. The hub and `then` overlay facts only; `then_failed` reads the pre-decision world; `leadOn`'s own comment (`behavior.ts:125`) says "as the decision leaves it". Played through the engine:

| Content | Result | Should be |
|---|---|---|
| `receive` + `then`, target option needs `has_item` | talk silently ends after "here's the key" | opens the follow-up |
| `receive` + `then`, target option `not has_item` | card with every option refused, contradicts `mechanics.md:492` | ends |
| self-gated `receive` hub, options `not has_item` | card with every option refused | ends |
| failed check practice, `then_failed` target `skill_compare at_least 1` | silently ends | opens |
| failed check practice, target `not skill_compare` | card with every option refused | ends |

The give-then-follow-up is the commonest RPG conversation shape, and an author has no workaround on `has_item`. `mechanics.md:490` ("fact writes only") partly sanctions the overlay but conflicts with `:492`, so the spec moves too.

Fix, tried and reverted here: at both sites `const r = apply(world, a.delta.ops, false)` (`runtime/apply.ts`, already imported by other mechanics), `if ('fault' in r) return decided`, read `r.world`; drop the `sequence` import. All five rows then behave as the last column; `dialogue_branching` and `dialogue` 41/41; `test/transcripts.test.ts` passes, so showcase replay is unchanged. Amend `mechanics.md:490,498` ("the decision's own writes"). Add tests pinning rows 1 and 4; the current suite stays green either way.

**S1 should-fix: `selection.ts:36`.** A loop enters at its first key by sort, with no regard to speaker. Keys `captain_talk`, `guard_talk` in a two-speaker loop: Talk to the guard is `rejected:unsupported_capability`, the same as an NPC with no dialogue, and the compile says nothing. Spec-conformant (`mechanics.md:492`), silent for the author. Smallest fix: a compile warning.

**S2 should-fix: `dialogue_branching.test.ts`, no assertion on `behavior.ts:145`.** Mutant `position + 2` survives; a gap in the event order goes unnoticed. Assert the `choice_opened` position once.

**N1 nit: PR body** says "dialogue_branching, dialogue 42 pass"; rerun at head: 41. **N2 nit: PR body** cites `cartridges/showcase`, which does not exist; `cartridges/toolbox_showcase` and its hash fixture are empty against main, so the substance holds. **N3 nit: `lib/loka/content/hub.ex:97`** `key/1` public with no outside caller found.

## Rulings asked of this review

| Item | Ruling |
|---|---|
| `behavior.ts:102` hub reopens past its policy, all refused | Not a dead end: `closable: true`, `close_choice` accepted, view null. Same as main, not made easier (`leadOn` checks policy; `shown` narrows). A `holds` check ends it but `walk_economy_jail.jsonl` line 22 loses `choice_opened`, and `mechanics.md` "keep their declared availability" pins it. Follow-up needing a spec change and regenerated transcript; not this slice. |
| `behavior.ts:99` facts only | B1. |
| `rule.ts:110` `then_failed` world | B1. |
| `shared.ts:219` stale row draws refused labels | Keep: a row must offer Leave. With B1 fixed only a row the world moved under reaches it. |
| `selection.ts:36` cycle entry | S1. |
| `hub.ex:97` | N3. |
| `dialogue-receipt.ts:84` variant `when` not re-evaluated | No finding. Receipts are stored, not replayed; membership suffices. Custody receive with variant and `then` reopened cold at every step. |
| `fact_at_least` op | Accept. Every fact predicate site carries it; `fact_compare`-only sites generate literals or match equals by design. |
| `then_failed` sibling | Accept; `then_failed: self` retry adds no new exploit (check practice as any retry). |
| Absent-speaker farewell ends the talk | Accept; consistent with `parted`; `SPEAKER_ELSEWHERE` warns. |
| Prompt redraw on return (question) | Keep as authored for slice 1. The brief says no repeat where the reply said it; `book-ui.md:529` says it draws again. PM to rule which wins; hub answers already write around it. |
| Can the Book offer an option that refuses? | No option marked `available: true` was ever refused in any scenario. The only offered-but-refused state is the all-refused card: B1's rows (gone with the fix) and the `behavior.ts:102` hub. |
| Showcase bytes | `git diff origin/main...HEAD -- cartridges/toolbox_showcase protocol/fixtures/toolbox_showcase_hash.json` empty. |

**Question for slice 2:** a flat answer on a back-linked root ends the talk (spec-conformant). An RPG hub needs `then: <self>` on each answer. Worth one line in the authoring guide?

## Second opinion

Warranted: [Review count](../WORKFLOW.md#review-count) names protocol, and this slice changes `protocol/dialogue.schema.json`, `policy.schema.json`, `cartridge.schema.json`, `capability_registry.json` and `kernel_api`. Precedent gives no carve-out for additive fields: `loka-vx2v` (additive quest schema) took one; `loka-rn3b` did not.

Scope it to the fix head, narrowly: the additive contract (`contracts.gen.ts` adds only `then`, `then_failed`, `policy`, `narration_variants`, `fact_at_least` and the `SPEAKER_ELSEWHERE` code) and the load-time acceptance widened at `dialogue-receipt.ts:84`. Save shape itself gives no extra ground: `dialogue-save.ts` is untouched, `ChoiceRow`, delta ops and GameView are unchanged, cold reopen green at every node including custody.

## Open item, pre-existing, not this PR

A non-quest `hand_over` of a `give_allowed: false` item back to the NPC after a custody `receive` makes the next load `save_corrupt` (`dialogue-save.ts:62`, holder is an NPC). Control with no `then`, no option policy, two dialogues and two separate talks fails the same way. A permanent save brick an author can compile. `then` makes the path easier to write. Needs a Beads issue: compiler refuses it, or the save accepts it.

## Test the tests

Narrow mutants on the PM's instruction, null controls green; `bin/mutate_diff.sh` not run. All restored.

| Mutant | Result |
|---|---|
| hub `then` on pre-world; hub `shown` on pre-world; linked reopens itself; hostile check dropped; target policy dropped; target `shown` dropped; `then_failed` ignored; cycles not entered; `at_least` strict; talk ignores `shown`; receipt ignores variants; orphan `then_failed` allowed; `end` clash allowed; keyword target allowed; self gate ignored; self gate always | red |
| `leadOn` position `+ 2` (`behavior.ts:145`) | green: S2 |

Claims rerun: "hub then clause red by hand (17/18)" backed; `content_ferry` 18 backed; "42 pass" not (N1). No frozen fixture or expected answer touched. `receiptHolds` injecting `patrol: {}` is acceptable; a real custody path probe holds. PR body reports `/code-review medium`. No Book code, so no screenshot to judge. Composition record names no other mechanic in capability code; its "fact writes" wording changes with B1.

## Not run

Dead-speaker hand-off (shares the `parted` line, not played separately); hostile only by existing test and mutant; escort or `skill.acquire` with `then` across reload.

## Disposition

Fix commit below; see the re-check.

## Fix re-check at 50742a46a

Commit `50742a46ab607e99832f942bf65f789c280d530d`. CI by `gh run list --commit`: ci, book-e2e, graph-diff all completed success. Verdict: **CHANGES REQUIRED**.

| Item | Disposition |
| --- | --- |
| B1 | Closed. Own inputs: `receive` + `then` to `has_item` opens, to `not has_item` ends; flat self-gate ends; failed-check practice through `then_failed` to `skill_compare` opens, its negation ends. `leadOn` covers `then_failed`: `rule.ts` passes `start`, `leadOn` applies its ops. |
| S1 | Replaced by S3: the compile refusal closes the silent case and over-refuses. |
| S2 | Closed. Position `+ 2` is now red. |
| Open custody item | Partly closed; B2, B3 and S4 remain. |
| `mechanics.md` | Amended correctly (post-decision world). |
| Size allowances | Acceptable: `handoff` 42 lines (allow 45), test file 538 lines (allow 545), both with reasons and precedent. |

### Findings

**B2, blocker, `mobile/authority/local-story/dialogue-save.ts:151`.** `expect` refuses two selected choices that assign one fact different values, and it runs over every receive and hand_over of a custody item. Content: `give_allowed: false` item; take sets a flag; give clears it, the natural gate for a take and give-back. It compiles and every command is accepted in play. The next cold reopen is `save_corrupt`, and the player's story does not open. The PR's test has no steps. Take/give with steps on different facts, and take with its step and no give, load. The PR does not touch `expect`; by trace a quest hand_over with a conflicting assign reaches the same refusal on main. This PR adds the non-quest path that lets the natural content compile, play and then fail.

**S3, should-fix, `lib/loka/content/dialogue_links.ex:71`.** `unreachable?` never asks whether a root reaches the loop, against the comment above it ("a loop no root reaches"). Guard root, then `then: <second speaker>`, then `then: guard` is refused (`OUTCOME_MISMATCH`). That shape composes two spec lines (Hand-off, `then: <parent>`). With the refusal switched off it plays the full round trip, no issues. The one-way hand-off leaves the second speaker just as untalkable and compiles. The author's only way out is an unwanted Talk entry for the second speaker. Refuse only where Talk cannot enter as intended, or warn as `SPEAKER_ELSEWHERE` does.

**S4, should-fix, `dialogue-save.ts:48` and `:204`.** Answer counts are bounded above, not paired. After a reload, forged custody loads: take/give with the item moved back onto the player (no second take); take/give/take with the item moved to the guard. A save edit gets a `give_allowed: false` item the answers do not account for. Require `resolved.length` to equal `handedBack` plus one while no terminal hand-over holds it.

**B3, blocker (green mutants), `dialogue-save.ts:48,50,204,205`.** Five narrow mutants stay green against every local-story test file that mentions custody, receipts, `receive` or `hand_over` (null green): `:48` removed, holder check off, received check off, non-quest receipt unchecked, receive receipt unchecked. The new evidence branch has no forged-state test. Add forged-state cases with the S4 fix.

**Question, `dialogue-save.ts:210`, traced only.** Take, non-quest give to a guard, retake, then quest hand_over to that guard. If the non-quest dialogue iterates first, `completed` is true and `done && completed` refuses a legal save?

### Probes

Forged, after reload, refused as they should be: no answers with item on the captain; taken, moved to the guard with no give; taken, moved to the captain; give-to-captain row, item moved to the guard; give row deleted. Legal, after reload, load: take/give; take/give/take; take/give/take/give.

| Mutant (null kernel, save, Elixir all green) | Result |
| --- | --- |
| `leadOn` reads pre world; hub reads pre world; `leadOn` position `+ 2`; `then_failed` gets no practice | red |
| `loops/1` off; cycle condition off; speakers ignored; `handedBack` returns 0 | red |
| the five in B3; `handedBack` counts quests (smaller file set only) | green |

Not run: fact-gated give through a chain or to a captain at reload; dead-speaker and escort cases from the first round. The forged cases are save edits, so S4 needs local file access to exploit.

## Fix re-check at 34700e6ac

Commit `34700e6ac3d17b2ab5c1fcebae51ad4cf5651537`, round 2, the last. CI by `gh run list --commit`: ci, book-e2e, graph-diff all completed success. Verdict: **CHANGES REQUIRED** (F1, F2). Governing rule: the PM's ruling in the `loka-vduxr.10` notes (not the owner's): never refusing a lawful save outranks catching every forgery; a forged save that loads must not throw on every launch or persist corruption. Whether the save guarantee covers tampered saves stays an open owner question.

| Item | Disposition |
| --- | --- |
| B2 fact-set take, fact-clear give | Closed for op writers; `branching_reload` green. Residue is F2. |
| B3 five green mutants | Closed. The `:57`, `:66`, `:132`, `:130`, `:241`, `:206`, `:232` mutants below are red. |
| S3 refused root, hand-off, return chain | Closed. Warning `LOOP_SPEAKER` (`dialogue_links.ex:69`), in explain, schema and `mechanics.md`; the compile task prints warnings; severity mutant red. |
| S4 forged custody loads | Closed by the ruling. `branching_forged` plays on after forged holder; forged facts, deleted quest row and forged terminal row are still refused. |
| Question, retake then quest hand_over | Closed. Reloads, test green. |
| Narrate step on receive, skill.acquire, escort | Closed. `dialogue-consequences.ts:51` and `rule.ts:186` mutants red. |
| Refusals on main | `message.test.ts` three-dot diff empty. Only test deletions are two setup lines in `escort.test.ts`. |

### Findings

**F1, blocker, `mobile/authority/local-story/dialogue-save.ts:232`.** Ran it. A custody item with two variant dialogues of one quest told apart by policy (`y_a` when `gate_open`, `z_b` when not), both offering choice id `deliver` with `hand_over` to the clerk. Take, accept, deliver through either one, reopen: `save_corrupt` on every launch. The guard looks only at this dialogue's key, so the variant nobody answered refuses. Same when `z_b` is a plain `deliver` answer resolving the quest with the token kept. Control with distinct choice ids loads. By reading, main's guard is also keyed to one dialogue, and dialogue `policy` predates this PR, so this is probably not a regression (no run on main); branching makes the shape likelier. Fix direction: accept an answered row of any dialogue of that quest with that choice id, keeping `branching_forged:94`. A `quest.resolve` reaction with the same outcome is the same line by reading, not run.

**F2, blocker, `dialogue-save.ts:178-182,206`.** Ran it. `factWriters` counts only dialogue ops. Topic `gate` with fact `known`, answer `a_learn` granting it, one-way take with `fact.assign known true`: learn before take, reopen, `save_corrupt` at `:210`. Control without the grant loads. Scene `on_end.assign` and combat credit write facts the same way, by reading. Same class as F1 and the residue of B2, a blocker: a lawful save refused on every launch. By reading, main's check also ignored other writers (no run on main). Fix direction: skip the check when a non-dialogue writer of that fact exists (topic grant, scene `on_end.assign`, combat credit, rest), keeping the `branching_forged:48` refusal for a fact only dialogue writes.

**F3, should-fix, PR #544 body line 45.** It says reload "validates only what a row asserts", that a forged terminal quest row now loads, and that `message.test.ts` refusal cases moved or went. At this head `message.test.ts` is unchanged and `branching_forged:94` refuses. The owner would read a removed guard that was kept. The body also has no round for this head's fix.

### Probes and open items

Eliminated: `repeatable` non-exchange quest (compile refuses); per-subject fact on a take (`FACT_SCOPE_UNSUPPORTED`). `oneWayStarts` (`:126-134`) refuses nothing by itself, it only drops item inference, so it does not restrict a writer. Real samplers: no cartridge dialogue moves a custody item (`give_allowed: false` with a non-quest `receive`) and none uses `then`, so there was nothing real to replay; every probe is constructed content.

Open: F1, F2, F3. Question, not run: reaction `item.move`; giver killed before the take (holder corpse, `:66`); crow theft (`:68`). `:66` and `:68` are on main too.

| Mutant (null 54 pass on reload, forged, escort; 78 with `quest_started_at`, `quest_deadline`, `message`) | Result |
| --- | --- |
| `:57`, `:66`, `:130`, `:132`, `:206`, `:232`, `:241`; `dialogue-consequences.ts:51`; `rule.ts:186` | red |
| `:68`, `:78` | red, only in `message.test.ts` |
| `seen` check removed in `handoff` walk | hangs, counted killed |
| `LOOP_SPEAKER` severity | red |

Not run: full mutate_diff sweep (narrow sample, as briefed); the Elixir and TypeScript rules were not compared in this round.

## Fix re-check at 82e8c0a1d

Broad re-review, commit `82e8c0a1deeb2bf7be9a7ef7962419748cb011ff`. CI at that sha: `graph-diff`, `ci`, `book-e2e` all completed success. **Merge held for Fable on E1**, a pre-existing lawful-save refusal, under the PM's rule for the round. **Verdict on what this PR changes: APPROVE WITH NOTES.**

Must be true: ([save](../system/save.md#escort-and-alternate-return-recovery), PM round rule) a lawful committed state reopens; a forged state refused only for row shape, id, bindings, receipt identity, or a holder cycle; a forged state that loads does not throw on launch, loop or corrupt the next save.

### Disposition

| Item | Result |
| --- | --- |
| F1 policy variants sharing `deliver` | Closed. `branching_lawful` green. |
| F2 topic grant before a take | Closed. `branching_lawful` green. |
| F3 PR body | Closed, one nit below. |
| Deleting `topics-save.ts` | **Justified, not scope creep.** Main's file restored at this head: `topic grant before a one-way take`, `reaction setting the fact before a one-way take`, `moving answer writing one fact twice` go red, and shipped `identity_sampler` (`reactions/houndbane.json`) and `ask_sampler` (`reactions/square_topics.json`) give `save_corrupt` on cold reopen after one move. Loses only refusal of forged topic, perception and riddle facts; a forged topic shows a codex entry, no throw. |
| #546 `kernel/ts/src/mechanics/dev/rule.ts:40-77` `provenFacts` | After #544 its topic, perception and custody clauses guard nothing and block set-fact needlessly; expedition and deadline clauses stay valid. Rebase and trim on #546. Not a #544 finding. |
| Forged states, each played open, act, save, reopen | Branch fact reset or deleted; back with courier; NPC-held; terminal fact reset; terminal returned; held by `no-such`; resolved with no branch; forged resolved hand-over; two quests handed over; moved with no take; fact forged then give. None throws at launch, loops or corrupts. Worst outcome: an ordinary rejection that dead-ends that forged quest. |
| `holderLoop` | No lawful path: every transfer passes `kernel/ts/src/foundation/compose.ts:272` `containment_cycle`. Removing it hangs the suite. |
| `fact_at_least` in Why | Correct, `kernel/ts/play/why.ts:140`; clause mutant red in `why.test.ts`. |

### Findings

**E1, should-fix, pre-existing, for Fable: `mobile/authority/local-story/escort-save.ts:46,127,128`.** Lawful saves refused. Real play then cold reopen, each `save_corrupt`: following, child killed by the player (`:46`; the same session's next Move also faults `evaluator_error` from `kernel/ts/src/mechanics/escort/shared.ts` `following()`); completed, keeper killed (`:127`); completed, child killed (`:46`); completed, child moved by a reaction `npc.move`, no combat (`:128`). Controls reopen: completed with nothing killed, keeper killed before the end. The PR changes only return values here and the kernel rule is unchanged. Reproduced on `origin/main` 927e9d85c: following child killed and completed keeper killed give `save_corrupt`; the control reopens. [`save.md`](../system/save.md#escort-and-alternate-return-recovery) (`:431-438`) both mandates these checks and requires every committed state to reopen, so the spec contradicts itself. No shipped cartridge has an escort choice, only the fixture. Fix shape: delete the three checks after a ruling on what a following escort with a dead NPC does on Move.

**S1, should-fix, `docs/system/save.md:546,1062-1078`; `docs/system/mechanics.md:2472`.** `save.md` still requires reconciling topic truth with grants and refusing forged ones; the code now forbids it. `mechanics.md` still says `dialogue-save.ts` reconciles facts. The next developer restores the check from the spec and breaks `ask_sampler` saves.

**S2, should-fix, test gap, `mobile/authority/local-story/dialogue-save.ts:75,86,87,97,100`.** Removing the beat, bindings, attempts, open-row `choice_id` or actor clause leaves all story tests green (null green). Not raised to blocker: the clauses are unchanged from main, and the beat and bindings mutants add no red on main either (all story tests; null has 6 reds in other tests, e.g. hut and elapsed, count unchanged by each mutant). But after this round they are the guards left and the PM rule keeps bindings by name. Failure: a refactor drops the bindings clause and a forged item role moves another item, unseen.

**N1, nit, PR body.** `/code-review medium` is reported at `1fbc8ccdd`, before this rewrite; run it in the fix round.

**N2, nit, PR body.** "null control red" should say green. It also omits that deleting `topics-save.ts` fixes `save_corrupt` on shipped samplers.

**N3, nit, `lib/loka/content/hub.ex:79-92`.** `proven` still refuses a repeating hub choice for a reason save recovery no longer has. Over-strict only; the PR lists it as open.

**Question, not run on main.** A forged body and satchel holding each other, with no custody item in the chain, throws in setup and look. It is outside `dialogue-save.ts`.

### Test the tests

| Mutant (null green on the listed files) | Result |
| --- | --- |
| `holderLoop` off | hang, counted killed |
| `movesItem` always false; ignores `hand_over` | red, 2 each |
| `:23` early return ignores escort rows | red |
| Custody inference added (holder must exist) | red, 21 |
| `escort-save.ts:58` receipt off | red, 3 |
| `why.ts:140` `fact_at_least` clause | red |
| `:96` `openable`; `:99` `choice_ids` | red only in `hidden_skill.test.ts` |
| `:86` beat; `:87` bindings; `:97` attempts; `:100` open row; `:75` actor | **green, all story tests** (S2) |

Claims rerun: `lib/loka/content/population.ex:250` `scavenge_item?` refuses Give-restricted items, as cited; `why` and `why_words` 15 pass, as stated.

Not run: `bin/mutate_diff.sh` this round (narrow sample, as briefed); the `npc.move` and completed-child E1 cases on main; attempts, open-row and actor mutants on main; Elixir and TypeScript rule comparison.
