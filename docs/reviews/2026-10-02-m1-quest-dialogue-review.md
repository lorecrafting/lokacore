# Review: M1 Quest from dialogue (Bram's offer becomes a dialogue choice)

- PR: #120, branch `m1-quest-dialogue`
- Commit reviewed: `ea3cd6b`
- Brief: `quest-dialogue-brief.md` (PM settlement 2026-10-02 included); owner decision
  `docs/decisions/owner-decision-quest-from-dialogue-2026-10-02.md`
- Stance: full (contract slice). Mutation tested in a throwaway worktree; `bin/check_all.sh`
  green at `ea3cd6b`; CI green (bundle, elixir, lint, typescript)
- Not waited for: iPhone device rows (phone locked). The codex Sol review is appended by the PM.

**Verdict: CHANGES REQUIRED** (two should-fix; no blocker)

## What must be true (written before reading the diff)

From `docs/system/mechanics.md` quest@1 and dialogue@1 (on main), `docs/system/cartridge.md`,
the owner decision and the brief:

1. A dialogue choice can start a quest: choosing it applies quest@1's activation
   (`quest.activate` at player scope, `quest_activated`) in the choose's own decision, and the
   outcome stays the choice id.
2. The accept never double-activates: choose of an accept refuses `invalid_state` when the actor
   already has an instance, whatever the talk-time policy said.
3. `QuestDefinition.offer` is optional; no offer means no `accept_quest` action. Ashmere Ferry and
   `accept_quest` do not change.
4. A speaker may have several dialogues, in both loaders. A talk opens the first dialogue in key
   order whose own policy holds; none holding is `invalid_state`. The GameView agrees with step.
5. Both loaders reject, with existing codes and the same paths: an accept that names no quest of
   the cartridge, an accept in a dialogue that has a `quest`, an accept with a `hand_over`. A
   short `accept` reference is expanded by `Loka.Content.Checks.expand/2` (contracts lesson).
6. The frozen traces and adverse cases are rewritten by hand from the spec. Ferry and every other
   fixture are byte-identical. No new DiagnosticCode, no `proposal.ts` change, no policy-schema
   change.
7. The spec amendment is in `docs/system`, not in `docs/archive`. The schema regen changes only
   descriptions plus `DialogueChoice.accept` and `offer` leaving `required`.

## Checks

1. Met. `kernel/ts/src/rules/dialogue.ts:138` `quest()` plus `quest.ts` `activation` (shared
   with `rules/quest.ts`; no rule imports another rule). Outcome is `choice_id`.
2. Met in step (`rules/dialogue.ts` `questOf(...) ? 'invalid_state'`). Not met in the GameView: F-1.
3. Met. `actions.ts:134` `!offer ||`; quest loaders guard `q.offer` (TS `cartridge_quests.ts`,
   `cartridge_refs.ts` nodes; Elixir `quests.ex` texts).
4. Met for talk. Both loaders drop the check. `dialogue.ts` `spokenBy` and `talkRefused`; `lists`
   uses `speaks` and `talkRefused`. Overlapping policies: ruling (a) below.
5. Met. TS `cartridge_dialogues.ts` `choice`, Elixir `dialogues.ex` `accept/5`, `checks.ex:126`.
   Same codes and paths in both (`.choices.accept.accept` and `.hand_over`).
6. Met. `cartridge_ferry_hash.json` and every other fixture are untouched. In `adverse-cases.json`,
   only the `lantern` suite changed. The fixtures commit `7177e18` precedes the kernel commit
   `01d9adf`, and no later commit touches the conformance files. Spot-checked by hand: trace
   revisions shift +1, the accept narration enters every later list, and early-possession is
   prefix `[2,9)` then talk, accept, talk, choose at revisions 8-11. `proposal.ts` and
   `policy.schema.json` are unchanged.
7. Met. `docs/system/mechanics.md`, `cartridge.md`, `protocol.md`, `save.md`, `owner-rules.md`.
   I compared each changed `protocol/*.schema.json` with its `description` keys stripped (jq):
   six files are identical. The only structural changes are `dialogue.schema.json` (`accept` and
   one example) and `quest.schema.json` (`offer` leaves `required`). `invalid.json` drops the
   `/offer` missing_property row and adds `/choices/e/accept` invalid_type. Every remaining
   `docs/spec|decisions` path in the descriptions is live.

## Mutants (each reverted; worktree removed)

| # | Mutation | Result |
|---|---|---|
| E1 | Elixir: restore one dialogue per speaker (`dialogues.ex` `shared`) | red: `content_lantern_test` known answer, `content_ferry_test` "a second dialogue of Bram's" |
| E2 | Elixir: drop the accept-in-quest-dialogue check | red: ferry test |
| E3 | Elixir: drop the accept-with-hand_over check | red: ferry test |
| E4 | Elixir: drop the accept reference check | red: ferry test |
| E5 | Elixir: drop the `expand` clause for `accept` | red: lantern known answer and ferry test |
| T1 | TS GameView `talkRefused` looks at the first dialogue only | kernel green; mobile red (23 tests, Lantern traces and adverse cases) |
| T2 | TS `spoken` reversed key order | red: `quest_dialogue.test.ts` |
| T3 | TS drop the stale-instance refusal | red: stale accept test |
| T4-T6 | TS drop each new loader check | red: loader accept test |
| T7 | TS offer action listed even with no offer | red: kernel and mobile Lantern |

## Findings

- **F-1 should-fix: the GameView offers an accept choice that step refuses.**
  `kernel/ts/src/dialogue.ts:87`. `choiceView` gets availability only from `blocked` (presence
  and custody), so it never shows the new `invalid_state` for an accept.
  - Scenario (the stale-accept test's own world: ferry plus `bram_offer`): talk to Bram, then
    `accept_quest lantern` through the offer. `gameView(...).choice.choices` is
    `[{available: true, choice_id: "accept"}]`, but `choose accept` is rejected `invalid_state`.
    I ran this probe.
  - Lantern cannot reach it (it has no offer). Any cartridge whose quest has both an offer and an
    accept dialogue can, and the loader allows that.
  - Fix: mark an accept choice unavailable with `invalid_state` while `questOf` holds. Assert it
    in the stale-accept test.
- **F-2 should-fix: the walk lesson still presses the removed place action.**
  `docs/lessons/mobile.md:57` still says `press "label=\"Offer to fetch Bram's lantern\""` at
  Ferry Landing before Map.
  - The brief names this selector. On the new build, that label exists only inside Bram's choice,
    after "Bram the ferryman, open" and Talk. So the device rerun or a Simulator walk that follows
    the lesson fails at step 3.
  - Fix: open Bram's page, Talk, then press the offer choice.
- **N-1 nit:** `kernel/ts/test/quest_dialogue.test.ts:121` says "twin of
  test/loka/content_lantern_test.exs". The twin is `test/loka/content_ferry_test.exs:267`.

## Rulings on the developer's questions

- **(a) Overlapping dialogue policies: neither a loader check nor a key in talk, now.**
  - A loader cannot decide policy overlap once facts, time or quest state are involved.
  - Carrying the dialogue key in a talk changes the command protocol (an Astra-class change).
  - Current behavior matches the amended spec (`docs/system/mechanics.md:122`, `:142`), and the
    Lantern policies are disjoint (no instance, then active).
  - Carry to R7/R8 as an open question. With two overlapping policies, the GameView shows two
    available "Talk to" actions that both open the first dialogue in key order, so the second is
    unreachable.
- **(b) OUTCOME_MISMATCH for both checks: accepted.**
  - The brief forbids a new code.
  - The paths (`.accept`, `.hand_over`) tell the two causes apart.
  - The existing use (story point in a dialogue that resolves no quest) is the same kind of
    outcome-configuration conflict.
- **(c) The Lantern prompt and narration are an owner draft, not blocking.**
  - The geography agrees with the rooms: north to the green, then the reed bank, then the
    shelter.
  - The prompt and narration text go to the owner for edits.

## Open items

- Brief Acceptance 4 (the reviewer's Simulator walk) was not run in this review. Run it after F-2,
  with the corrected selector, together with the device rerun.
- Device rows (iPhone 11, new hash `806508c7`): pending, PM appends.
- Codex Sol review: PM appends.

## Fix round 1 (`785818b..10e59e2`, reviewed at `10e59e2`)

**Verdict: APPROVE.** `bin/check_all.sh` green at `10e59e2`. Scope: the fix commits, the code
each touched, and its direct callers (`choiceView` from the GameView, `quest()` from `choose`).

| Item | Disposition | Check |
|---|---|---|
| F-1 (and Sol F2) | `choiceView` (`kernel/ts/src/dialogue.ts:96`) marks an accept unavailable with `acceptRefused`'s code, after `blocked` (`e83059e`) | Same order as `choose` (`blocked` first, then `quest()`). The stale-accept test now asserts the view. Reverting the view line: both accept tests red. |
| Sol F1 | `choose` refuses through `quest.ts` `acceptRefused`: an instance, or the quest's offer policy (if declared) failing, target none, as `accept_quest` admission (`e83059e`) | Reverting the instance check fails the stale test; reverting the offer-policy check fails the new offer-policy test; reverting the `choose` call (view kept) fails both. Lantern has no offer, so no policy leaf is added to its decisions (no frozen-trace or query_steps change). `quest.ts` does not import `dialogue.ts`: no cycle. |
| F-2 | `docs/lessons/mobile.md:56-61`: Bram's page, Talk, then the offer, then Map, Go north (`b3a612e`) | Every selector matched on the Simulator walk below. |
| N-1 | twin path fixed | read |
| (a) | carried to the R7/R8 row (`10e59e2`) | read |

Spec: `docs/system/mechanics.md` dialogue@1 and the `DialogueChoice` description name the new
offer-policy refusal and the GameView rule. The other `mechanics.md` edits are line-cite updates.

**Node anchor claim: confirmed.** At `10e59e2` I copied the M1 harness
(`docs/evidence/2026-10-02-m1-quest-dialogue-iphone11/dev-harness.ts.txt`) and the linked node
runner into `mobile/app/p6/`. `node p6/node-run.ts 18` printed `N=18 data.ts bytes=1999793
self-check failures=0`. `data.ts` sha256 is `2a7619ff937568fb…` and `node-expected.json` sha256 is
`ad63f530fcddd509…`. Both equal the evidence anchor, and `gzip -dc node-expected.json.gz` hashes
to the same `ad63f530…`. The device evidence at `ea3cd6b` holds for `10e59e2`. Copies deleted.

**Simulator walk (brief Acceptance 4): passed.** Release build of `10e59e2` (`expo run:ios
--configuration Release`), on a fresh private simulator (iPhone 11 Pro, iOS 27.0), driven by
agent-device. Screenshots in [2026-10-02-m1-walk/](2026-10-02-m1-walk/):

1. `01`: the Ferry Landing has no offer place action (only Bram, Scan, Map).
2. `02`: Bram's page shows one "Talk to Bram the ferryman".
3. `03`: Talk opens the `bram_offer` prompt with "Offer to fetch Bram's lantern" and Close.
4. `04`: after the offer, the narration is "You say you'll fetch it…" and the journal shows
   "Bram's lantern: active".
5. `05`: the walk went north, east, east to the Lantern Shelter, and took the lantern.
6. `06`: back at the landing (west, west, south), Bram's page again shows one Talk.
7. `07`: Talk opens the `bram` choice (carry, leave, Close).
8. `08`: I chose "Leave it with the search party": party-led landing text, "The story ends here".
9. `09`: the journal shows "Bram's lantern: resolved". Bram's page then says "Nothing to do here."
   (no dialogue holds).

Note: I first walked on the shared booted simulator (`polish-414`). Partway through, another
process installed a different Loka build on it: the bundle had no `bram_offer` text, and the app
showed the old offer place action. I discarded that run and redid the whole walk on a private
simulator, deleted afterwards. On `polish-414`, I uninstalled the app once before that other
install, so any save that was on it is gone.

## Codex Sol reviews (gpt-6.1-sol), appended verbatim by the PM

### First review (ea3cd6b)

CHANGES REQUESTED

```text
F1 | blocker | kernel/ts/src/rules/dialogue.ts:149 at ea3cd6b
Choice activation bypasses the quest’s offer policy. In a valid cartridge with offer.policy = has_item(lantern) and an always-available accept dialogue, an actor without the lantern gets invalid_state from accept_quest but successfully activates the same quest through choose. This path checks only whether an instance exists. Enforce any declared offer policy before activation.

F2 | should-fix | kernel/ts/src/dialogue.ts:95 at ea3cd6b
A stale accept choice is advertised as available. Open its dialogue, then activate the quest through its offer while the continuation remains pending. GameView still reports available:true for accept, although choosing it returns invalid_state. Include the per-option activation checks when calculating choice availability.
```

### Fix round 1 re-check (10e59e2)

APPROVE

No findings.
