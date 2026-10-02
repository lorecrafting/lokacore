# Early R7/R8 gate review: the stage and the gate PR

- PR #95 (`r78-gate`), reviewed head `2ec981538ee352fdcdd6ee29e0ac069be0e1c3b4` on 2026-10-01
  (docs only; `main` at `8bbdccf`, #96 merged in). The stage under review is `main` at `8bbdccf`
  plus this PR's diff.
- Depth: full gate review (WORKFLOW "Milestone gate: docs tidy pass", "Review stance"), per the
  R6 precedent. Reviewer: a fresh Opus agent that authored none of the stage or this PR. Brief:
  `gate-brief.md` with its PM settlement (P1, P2, P3, P4, P-fix, P-records, size rule).
- Scope: the Early R7/R8 slice table (Q #82, S #83, R #85, N #88, D1 #90, D2 #93, G #94), plus
  #91, #92 and #96. This is not 14's Gate R7 or Gate R8.
- Verdict: **CHANGES REQUIRED**. The stage's code passes: kernel tests are green, both planted
  mutants die, and the Astra audit's two blockers are fixed on `main` by #96. What blocks is the
  record, as in Gate R6:
  - one slice carry has no landing row (E1);
  - #96 is missing from the closure (E2);
  - the Fable retirement the PM plans needs dependent edits, or WORKFLOW will contradict itself (E3);
  - the new size rule can be read two ways, and the next `proposal.ts` slice will hit it (E4).

## What must be true for the gate to pass (written before reading the diff)

1. Each Early R7/R8 deliverable (the slice table, Q to G) is built and covered by tests with
   literal or fixture expectations. Anything not built is deferred with a STAGE landing row
   (the Gate R6 lesson: a slice row alone is not a landing).
2. `proposal.ts` has been reviewed whole. The Astra audit's findings are fixed on `main` (#96,
   reviewed). #96's own carries have stage-row landings:
   - activate-then-acquire faults `conflicting_write`, widening 04 §5.3 Lifecycle (:313);
   - the untested `before = now(p)` branch.
3. The ponytail audit of `kernel/ts` is recorded, with a landing row.
4. Every carry raised in the slice reviews has exactly one stage-row landing. The confirm-only
   items are actually closed on `main`.
5. The Early R7/R8 ROADMAP row is closed:
   - every merged PR is named;
   - every review is linked;
   - the gate review is linked;
   - every deferral points to a row.
6. The 2026-10-01 owner decisions are in `docs/decisions/`, marked (paraphrased) and indexed.
   Each superseded record carries a "Superseded in part" line. WORKFLOW and `.claude/agents/`
   hold no rule that contradicts them.
7. The docs tidy pass is done: no fact stated twice, no stale lesson, no catch-all.
8. The CHECKS.md size rule is unambiguous and matches the check. The files named as at their
   cap are at their cap.
9. Docs only: nothing outside `docs/` and `.claude/agents/` changes. The checks are green.

## Evidence

- CI on PR #95 at `2ec9815`: elixir, lint and typescript all pass. `gh pr view`: head `2ec9815`.
- In a throwaway detached worktree at `2ec9815`:
  - `npm run typecheck && npm test` in `kernel/ts`: exit 0, 278 pass.
  - `elixir bin/check_docs.exs`: exit 0, 206 docs, 0 broken links.
- Mutants, each reverted:

  | Mutant | Result |
  |---|---|
  | due-job set `j.due_time <= advance.to` changed to `<` (`proposal.ts:261`, slice S) | 5 fail |
  | presence revalidation deleted (`dialogue.ts:62`, slice D1) | 1 fails ("a stale choice revalidates custody and presence") |

- The diff touches only `.claude/agents/developer.md`, `docs/CHECKS.md`, `docs/ROADMAP.md`,
  `docs/WORKFLOW.md`, `docs/decisions/*` and `docs/features.{json,gen.md}`.
- `:76`'s claim "each freezes protocol schemas" still holds. Every slice merge from #82 to #94
  changed `protocol/`, including N (4 files) and D2 (5 files).

## Check against the list

1. **Deliverables: met.** Every row of the table (Q to G) is merged. Each slice review recorded
   literal or fixture expectations and killed its mutants. My two mutants above confirm the
   suite still catches a break in S and D1 at the stage head. Narrowed-out parts land in a stage
   row:
   - scene@1 and the scene trigger: chapter-one row `:54`;
   - narration beyond pinned participants: `:54`.

   D2's recipe trigger is cut, not deferred.
2. **`proposal.ts`: met for the code.** I read the Astra answer (`gate-proposal-astra-answer.md`).
   It raised two blockers and nothing else, and both are fixed in #96: eligibility at emission
   (`proposal.ts:196-214`), and charging before the skip (`:228-232`). The Q-fix review checked
   both, with hand-derived 8192/8193 cases. #96's two carries are not yet in ROADMAP, which is a
   known PM addition. See "PM additions" below for their wording.
3. **Ponytail audit: met.** It is recorded in the R6P row (`:53`). Its nits have no bearing on
   behaviour.
4. **Carries: not met (E1).**
   - Carries a, b, d and f sit in R6P `:53`; c, h and i in the chapter-one row `:54`; e in
     Playtest `:55`. Each appears once in a stage row (f also stays in its kept slice row, `:83`).
   - g (`query_steps`) is present in `:53`.
   - The confirm-only items:
     - Q's carries to D (custody and presence; the writer-group clash): closed. D1 kills the
       "delivery writer group reused" mutant, and writer groups are now numbered only in
       `proposal.ts` (`:154`, `:232`, `:249`, `:275`).
     - S N2 (drain and quest groups both numbered from 1): closed by the same change.
     - R Q1: closed by PM decision, recorded in the `reaction.schema.json` description.
     - N's docs carry, the GameViewSnapshot "R6" wording: **not closed** (E1).
5. **Row closure: not met (E2).**
6. **Owner decisions: met for the record itself, with one gap (E3).**
   - The new record is marked (paraphrased) and indexed (`docs/decisions/README.md:83`).
   - The 09-30 review-flow record has its "Superseded in part" line.
   - `grep -n Astra docs/WORKFLOW.md` finds only the new rule (`:20`).
   - The early-r7r8 plan record (`:11`, "a cross-vendor review on every slice head") names no
     model, so it does not conflict.
7. **Tidy pass: met.**
   - The WORKFLOW `:25` catch-all is split: the stand-in goes to Models `:26-28`, the drafting
     rule to Loop step 2 `:47-48`.
   - The developer.md token-hygiene restatement is removed. `developer.md:9` already points to
     WORKFLOW Token hygiene. `reviewer.md:30` keeps its line, because it is that file's only
     pointer to the section.
   - The R6P row is long, but every addition is a labelled "CARRIED from …" sentence.
   - `docs/decisions/README.md:79` is reworded to "story point carry".
   - `lessons/mobile.md:50`: "Never hand-patch `ios/`" is the only patch line.
   - The `features.json` cells name their slice, and none is listed twice.
   - room-view README `:34` links 04 §15 and does not restate it.
8. **Size rule: not met (E4).**
9. **Docs only: met.**

## Files at their size cap at `2ec9815`

The PM named five files, a list made at `5f6bb3e`. #96 has since filled `proposal.ts` to the cap.

| File | Lines / cap |
|---|---|
| `kernel/ts/src/cartridge_refs.ts` | 315 / 315 (allowance) |
| `kernel/ts/play/main.ts` | 315 / 315 (allowance) |
| `lib/loka/core/compose.ex` | 313 / 315 (allowance) |
| `lib/loka/content/checks.ex` | 312 / 315 (allowance) |
| `mobile/authority/local-story/authority.ts` | 307 / 310 (allowance) |
| **`kernel/ts/src/proposal.ts`** | **300 / 300 (no allowance)** |

Tests at or near their cap:

- `kernel/ts/test/dialogue.test.ts`: 608 / 608;
- `mobile/authority/local-story/local_story.test.ts`: 648 / 650;
- `test/loka/content_test.exs`: 498 / 500.

The following allowances were added or raised during this stage (`git diff 1477a2b 8bbdccf -G 'size: allow'`):

- `cartridge_refs.ts`: raised from 310 to 315;
- `local_story.test.ts`: raised from 580 to 650;
- `main.ts`: an allowance (315);
- `checks.ex`: an allowance (315);
- `dialogue.test.ts`: an allowance (608).

That is the pattern the new rule stops.

## Findings

### E1 — should-fix: N's GameViewSnapshot carry has no landing row, and the brief's "G rewrote it" is wrong

`protocol/gameview.schema.json:710`; source `docs/reviews/2026-10-01-r78-n-review.md:93`.

- The GameViewSnapshot description still ends "the acknowledgement protocol arrives in R6". The
  text dates from #14 (`1f96346`).
- G rewrote the GameView description at `:491`, not this one.
- R6 is closed and built no acknowledgement protocol. No ROADMAP row mentions it (a grep for
  `acknowledg` in ROADMAP and room-view finds nothing).

Failure scenario: P4 or P5 builds redisplay after a crash (carry f), reads "arrives in R6", and
either assumes the protocol already exists or never schedules it.

Edit: add one clause to R6P `:53` beside carry f, landing with P4/P5: "the GameViewSnapshot
`narration` description says the acknowledgement protocol arrives in R6; correct it when the
redisplay lands (a schema description change)". Fixing it in this PR is out of scope (a schema
file).

### E2 — should-fix: the closure omits #96 and its review

`docs/ROADMAP.md:52`.

The Done list names #82 to #94, #91 and #92, but not #96 (Q-fix, which changes `proposal.ts` and
`quest.ts`). It does not link `reviews/2026-10-01-r78-qfix-review.md` either. #96 is the stage's
fix for its own Q slice, and must-be-true 2 rests on it.

Failure scenario: someone reading the closed row for Q's history misses the two delivery fixes
and the carries that came from them.

Edit:

- add "#96 (Q-fix, the gate's proposal.ts audit)" and a Q-fix link to `reviews/2026-10-01-r78-qfix-review.md`;
- replace "gate review (the reviewer links its record here)" with
  a gate review link to `reviews/2026-10-01-early-r7r8-gate-review.md`.

### E3 — should-fix (conditional on the PM's Fable retirement): the dependent text must change with it

`docs/WORKFLOW.md:13`, `:16-17`, `:27`, `:36`;
`docs/decisions/owner-decision-review-rules-2026-10-01.md:20-24`;
`docs/decisions/owner-decisions-review-flow-2026-09-30.md:3-4`.

P2 settles "Fable only as stand-in when codex is out of quota". The new record does not say "only":
`:23-24` call the stand-in "an exception to 'Fable rarely', the rare backstop", which keeps the
rare backstop alive. Retiring WORKFLOW `:16-17` is needed, because otherwise WORKFLOW still allows
Fable for "very complex work", contrary to P2. But retiring that line alone leaves four places
in conflict:

- `:13` (table): "Fable rarely (see below)", where "below" no longer exists;
- `:27`: "(an exception to 'Fable rarely')";
- `:36`: the ladder's "a Fable subagent" rung, where Fable is used outside the stand-in;
- the record's Fable section, and the 09-30 "Superseded in part" line. That line names only
  Astra and Sol, not "Fable back but rare", which is the 09-30 record's own title.

Failure scenario: the PM escalates a hard decision through the ladder to a Fable subagent
(`:36`), which the owner's "Fable only as stand-in" forbids. Or a reader of the 09-30 record sees
no supersession of its Fable rule.

Edit: in one pass,

- drop "Fable rarely" from `:13` and `:27`;
- decide the ladder rung (drop Fable, or name it in the record as a second exception);
- say "only" in the record's Fable section;
- add "Fable as a rare backstop" to the 09-30 supersession line. The autonomy `:19` line (a PM
  addition) must cover the ladder's Fable rung as well as Astra.

If the owner did not retire the rare backstop, do not retire `:16-17`. In that case, change P2's
record wording instead.

### E4 — should-fix: the new size sentence has two readings, and `proposal.ts` is at 300/300 with three carries landing on it

`docs/CHECKS.md:31-32`.

"A slice that would push a file past its cap splits the file instead" has two readings:

- (a) "cap" means the base limit (300/500). Then no new `size: allow` may ever be added, which
  kills the escape hatch stated one sentence earlier.
- (b) "cap" means the file's current limit, so a first allowance is still allowed but never raised.

Failure scenario: the next slice touching `proposal.ts` takes the R6P carries (the root
`query_steps` counter, the `budget_exceeded` producer) or chapter-one carry c (the generation
re-read). Its developer adds `// size: allow 320` under reading (b). Its reviewer rejects that
under reading (a), or the reverse, and a fix round is spent on wording.

Edit: the PM picks a reading and words it. For (a): "No new allowance is added and none is
raised; a file at its limit splits." For (b): "An allowance, once set, is never raised; past it,
the file splits." Either way, name `proposal.ts` (300/300) for the PM's next brief that touches
it.

### N1 — nit: the reviews index header still says "cross-vendor (Astra) reviews"

`docs/reviews/README.md:5`.

Sol now does most cross-vendor reviews, and fix re-checks always. Reword it to "cross-vendor
(codex)".

## PM additions for the fix round (checked as asked)

| Addition | Needed? | Why |
|---|---|---|
| Retire Fable "rare backstop", WORKFLOW `:16-17` | Yes, if owner-sourced (P2 says "only as stand-in") | See E3 for the dependent edits. Without them WORKFLOW contradicts itself. |
| "Superseded in part" on `owner-decision-autonomy-2026-09-30.md:19` | Yes | The new record (`:7-8`) supersedes the ladder's "codex Astra", but the autonomy record has no pointer back. Per E3, also cover the Fable rung. |
| New leaning record `owner-leaning-realm-separation-2026-10-01.md` | Question | Nothing in the brief, the slice reviews or `main` references it, so I cannot judge its need. Confirm it is owner-sourced, marked (paraphrased), indexed, and not a decision (a "leaning" is a new record type for `docs/decisions/README.md`). |
| Q-fix carries in ROADMAP | Yes | They are in no row today. (1) Activate-then-acquire faulting `conflicting_write` belongs in the chapter-one row, landing with the first content that activates and acquires in one sequence. The clause should name the resolution: amend 04 §5.3 Lifecycle (`:313`) or make the composition legal in code. (2) `before = now(p)`, `proposal.ts:198` (mutant M5 survives, equivalent today) belongs in the same row, in the first slice where a job emits `item_acquired`. |
| Gate review link | Yes | See E2. Use this file's name, `2026-10-01-early-r7r8-gate-review.md`, not the brief's `r78-gate-review`. |

## Checked and fine

- The WORKFLOW Git hygiene rewrite does not contradict itself:
  - `:58` still says "never the main checkout";
  - `:76` moves main-conflict merges to `../lokacore-pm`;
  - `:123` limits removal to developer worktrees;
  - `:130-131` covers the PM's one-time dependency install.
- The new record's reason is accurate: D2's Astra first review was APPROVE WITH NOTES, with one
  wording fix; G's was APPROVE, with none.
- Simplicity: the diff adds one record, and every other change replaces text. Nothing to delete.

## Codex Astra gate review (verbatim, 2ec9815)

**CHANGES REQUIRED — PR #95, head `2ec9815`**

- **G1 — blocker — `docs/ROADMAP.md:54`:** #96’s activation-then-acquisition carry has no stage landing row. `quest_delivery.test.ts:139` explicitly expects `conflicting_write`; `2026-10-01-r78-qfix-review.md:37–43` carries its resolution to chapter-one content. **Fix:** add it to “R7/R8 for chapter one,” including the required reviewed widening of 04 §5.3 before enabling that composition. Include #96 and its review in the closure record at line 52.

- **G2 — blocker — `docs/ROADMAP.md:54`:** #96’s untested overlay branch also lacks a stage landing row. The review’s lines 60 and 69–71 document the surviving `before = p.world` mutant; line 100 confirms PM carry. Current code uses `now(p)` at `proposal.ts:197`, but current jobs cannot exercise the distinction. **Fix:** assign the regression to the first slice allowing jobs to emit acquisitions, explicitly in a stage row.

- **G3 — nit — `docs/features.json:379`:** The manually listed `kernel/ts/src/rules/dialogue.ts` duplicates the generator-derived module, appearing twice in `features.gen.md`. This misses the brief’s duplicate-entry tidy check. **Fix:** remove the manual entry and regenerate.

Other scoped deliverables have literal/fixture evidence or named stage deferrals. The original brief’s carries are present. WORKFLOW, its decision record, and the size rule agree with the settlement. Both original proposal blockers are fixed; no additional kernel defect found in the reviewed paths.

Validation: 114 focused tests passed; 13 transcripts/104 decisions replayed byte-identically; 10,000 fresh simulations plus two regression seeds passed. Typecheck, docs links, feature generation and TS size checks passed. Full disk/device and `check_all.sh` verification were not rerun. No files edited.

Size watchlist: `cartridge_refs.ts` 315/315; `lib/loka/core/compose.ex` 313/315; `lib/loka/content/checks.ex` 312/315; local-story `authority.ts` 307/310; play `main.ts` 315/315. After #96, `proposal.ts` is also 300/300.