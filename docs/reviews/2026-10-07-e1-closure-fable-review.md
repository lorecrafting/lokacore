# E1 closure review (Fable second opinion): PR #288 at `d30e21c2`

Draft PR [#288](https://github.com/lorecrafting/lokacore/pull/288), branch
`slice/chapter-one-e1-r9-certification`, head `d30e21c234520a03cef8e4c49b3652b0fc34e0aa`
against `origin/main` `cfc228ba`. Independent reviewer; authored none of the work. Governing:
[E1 exact candidate proof policy](../system/e1-certification.md#e1-exact-candidate-proof-policy),
[branch evidence](../system/e1-certification.md#e1-policy-branch-evidence),
[polish order](../decisions/owner-decision-chapter-one-polish-order-2026-10-07.md), the four E1
decision records, the [coverage-complete evidence](../evidence/2026-10-07-e1-coverage-complete/README.md).

**Verdict: APPROVE WITH NOTES.** E1 may close at coverage complete; #288 is safe to merge.

## Must-be-true list (written before the diff)

1. Pass is computed by code: all cases pass, zero pending, five family gaps empty, disposition and
   replay checks hold; exit 0/2/1.
2. Dispositions never add to witnessed; unknown or witnessed rows fail; `refusal` rows are
   machine-bound to case, exact code and the named dialogue.
3. Witnesses derive from replayed committed commands/states, not from a claim; no credit by
   offer, display, definition count, or another ending's dialogue.
4. No altered cartridge, hidden writer, player Wait or wall clock in the recorder.
5. No runtime behaviour change beyond a proved packaging defect.
6. Evidence trim and merge lost nothing.

## Checks run (exact head, own detached worktree)

- Recorder `node kernel/ts/test/e1_cases.ts tmp/e1-selected-v042.json <new dir>` (artifact sha256
  `1c53bcd8…`): **exit 0**, 38/38 pass, 614 witnessed, 34 dispositioned, all six gap lists empty,
  `source_sha` `d30e21c2`. Witnessed, dispositioned and coverage lists and all 38 final state
  hashes equal the committed `report.json`.
- `kernel/ts`: `npm run -s typecheck` exit 0; `node --test test/e1*.test.ts` 63/63.
- `elixir bin/check_docs.exs`: 333 docs, 0 broken links/anchors. The trim `2e9b1263` deleted 30
  evidence folders; no non-permalink reference to any remains. The index repair `d30e21c2` keeps
  every `main` line of `docs/reviews/README.md` and `docs/decisions/README.md`, no duplicates.
- Runtime diff: `kernel/ts/src/runtime/world.ts` comment-only; `test/sim.ts` exports `replay` and
  threads an optional action key; `elapsed-host.test.ts` split into `sqliteHost`; `bin/*` gain the
  `want=0` recorder path with planted controls. No mechanic or content change (item 5 holds).

## Red controls (each committed as a throwaway, then `git reset --hard d30e21c2`)

- R1 remove the `/resources/…:resource/ma` row from `e1_dispositions.json`: recorder **exit 2**,
  `authored_obligations` = that one path, 33 dispositioned. (A dirty tree is refused first:
  "source receipt requires a clean commit".)
- R2 set `refuse-peg-active` rows' code to `quest_requirement`: recorder **exit 1**, failure
  `refusal /dialogues/…a_peg_debt/policy/root/item` with actual `invalid_state`.
- R3 in `e1_obligations.ts` drop the dialogue `base` credit on `talk` and shift the modal line
  index by one: `e1_cases.test.ts` 3 red (opened dialogue, Elspeth predicates, modal steps).

## False-credit samples (all held)

- Static rows: `a_elspeth_lost` has no `label`, so talk selection is unkeyed first-in-key-order
  (`mechanics/dialogue/selection.ts`); `lost` is written only by `b_lost_before_meeting`, fired
  only by `ring_bell`, which assigns `prior` in the same step, so `a0_d9_elspeth_lost_prior`
  always precedes. `objectives_complete` persists only for `post_activation_event` objectives
  (`quest/lifecycle.ts:143-163`); all five dispositioned quests are `current_state`, and no
  recorded quest state is `objectives_complete`. Only one `quest.fail` (missing_child) and one
  deadline (chandlers_debt) exist; the kernel has no abandon writer. `seek_wisp` is
  `attribute_threshold` 5 on `per` (start 5, no attribute writer). `ma` has one reference.
- Rules: scenes credit by shown index against `narrate…await_ack,end` layouts (verified for all
  eight scenes); dialogue choice credit needs an accepted `choose` on a pending dialogue
  continuation; items/NPCs only from the committed post-move projection with static ids; refusal
  `final` is cleared by any later accepted step; `CHECK_FILES` covers every E1 module and the
  disposition table; all 57 room title keys equal `room.<key>.title`.

## Findings

- N1 (nit, question for the PM) `e1_obligations.ts:33-49` with v042 `infirmary_herbs` and
  `wisp_ward` objective roots `all([])`: `/objective/policy/root` is credited by vacuous truth on
  resolution. Within the rule's letter (the root holds); consider a "trivially true" disposition
  form if the gate's reading of "exercised" should exclude empty conjunctions.
- N2 (nit, Ponytail) `e1_cases.ts:72-94` hand-maintains the known case-id list that
  `recordCases` (`:286-309`) already defines; a mismatch fails closed, but it is duplicated structure.
- N3 (nit) `e1_case_host.ts` `visit()`/`capture()`: the five family gaps are captured in-process,
  not re-derived in replay like authored obligations. Safe for v042 (fails closed against
  `c.rooms` keys; dialogues/choices/scenes/quests are also authored obligations), but rooms rest on
  the title-key convention alone.

No blockers, no should-fix. Skipped: Elixir suite, `check_all.sh`, the thirty-days case's
internal assertions beyond its pass and replay.
