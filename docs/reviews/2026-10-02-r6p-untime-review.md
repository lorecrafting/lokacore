# Review: R6P Untime (no wait in the Lantern, earthly-branch status line)

- PR: #110, branch `r6p-untime`, commit reviewed `15226fe`
- Reviewer: fresh Claude Code agent (Opus), authored none of the work
- Spec: [owner decision](../decisions/owner-decision-untimed-lantern-2026-10-02.md) (paraphrased),
  [pre-release-proof](../spec/pre-release-proof.md) :45, :47, :59, :63, P3/P4 rows,
  [14 Gate R6P](../spec/14-implementation-plan.md), [R-MILESTONES](../spec/R-MILESTONES.md) R6P,
  [IMPORT](../spec/IMPORT.md) 2026-10-02 entry
- Verdict: **CHANGES REQUIRED** (two should-fix, one needing a PM/owner ruling; no blocker)

## What must be true (written before reading the diff)

1. The Lantern cartridge has no schedule and no wait for the proof; Bram stays at the landing; the
   clock starts at 06:00 and no proof action advances it.
2. Kernel unchanged: `wait`, schedule@1, calendar@1 and the due-job drain stay (no `kernel/ts/src`,
   `lib`, `proposal.ts` change), and the drain stays covered by some test.
3. Adverse paths keep their meaning: presence rejection with a close/return path, receipt replay
   after the player leaves, every other call fenced while a COMMIT is unknown.
4. Frozen fixture change is by hand, before the code, with pins and an IMPORT entry; the cartridge
   known answer stays Python-first and independent of the compiler.
5. Status line: the branch glyph on traditional boundaries (子 23:00-01:00 ... 亥 21-23), English
   label "Hour of the X, a to b"; presenter only.
6. No player-visible dead end introduced (06 §43 "never a trap"; review #49 A1).

## Findings

### A1 — should-fix (needs PM/owner ruling): movement exhaustion is a dead end again on the phone

`mobile/authority/local-story/smoke.ts:195` (Wait buttons gone), `mobile/app/book/Book.tsx:23`
(Wait page gone), `lib/loka/content/resources.ex:58` (schedule@1 still auto-locked),
`docs/spec/pre-release-proof.md:59`.
Scenario: the smoke controller over the Lantern known answer, tap Go north / Go south 41 times
(probe run on Node at `15226fe`). MV is 0/82; the buttons left are Offer, Look, Scan; GameView
still lists `wait` `available: true`, but no phone control presses it. The only exit is Start
over, losing progress. This is review #49 A1's scenario
([record](2026-09-25-r5-s6b-review.md)); on `main` the Wait page gave about 17 hours of
regeneration, so it was unreachable. Second face of the same cause: the compiled lock still has
schedule@1, so "no schedule and no wait" (:59) holds only for the touch UI; any other client can
send `wait`.
Fix (each option touches the owner decision, so the PM decides or escalates): a recovery action
offered only when a move cannot be paid; or accept Start over and say so at :59; or no MV cost
for the Lantern. Add the exhaustion-then-recovery test #49 A1 asked for.

### A2 — should-fix: the branch test pins 4 of 12 glyphs and 3 of 12 labels

`mobile/app/book/model.test.ts:151-167`. Mutants that swap 午/未 in the glyph string or
Monkey/Rooster in `ANIMALS` (`mobile/app/book/model.ts:69-74`) keep the suite green: the phone
would show 未 at noon, or read "Hour of the Rooster, three to five". Fix: one literal 12-row
table (start hour, glyph, label) from the owner's list, plus the 22:59/23:00/00:59/01:00 edges
already there (AGENTS.md allows table rows with literal answers).

### N1 — nit: test comment names a case its body does not mirror

`kernel/ts/test/dialogue.test.ts:389` now cites `walked-away-rejects-new-choice`, but the body
(:396-400) moves Bram by `wait` (the old moved-bram scenario). Say "NPC-moves-away variant of".

## Checks of the brief items

1. **Adverse cases.** `walked-away-rejects-new-choice`, `walked-away-keeps-receipt` and the two
   `choice-unknown-commit-*` fenced `other` calls hand-checked against the rules: move north at
   rev 9 to 10, `moved`, room green, clock 6, `bram_room` landing, RNG unchanged; rejected choose
   keeps rev 10; close gives 11; replay returns rev 10 `replay`. The new cases prove presence from
   the player's side only; the NPC-leaves side is kept by `dialogue.test.ts:396-400` on the
   kernel. Mutants killed: presence check removed (`kernel/ts/src/dialogue.ts:69`) fails the
   adverse case, the touch walk-away test and the kernel test; receipt lookup removed
   (`mobile/authority/local-story/authority.ts:173`) fails `adverse walked-away-keeps-receipt`;
   fence removed (`authority.ts:169`) fails both `choice-unknown-commit-*` cases.
   Git order: `2118793` changes only the fixture, the two pins and IMPORT; cartridge and code
   come after (`719e5e9` on); no later commit touches the fixture; SHA-256 `4b8f5a28...9526`
   matches IMPORT. Git shows order, not "before any run" (commits a minute apart); independence
   rests on the hand check above.
2. **Cartridge known answer.** `test/loka/cartridge_lantern_hash.py` regenerates the fixture byte
   for byte (`7076b526...ec9f`). "Python first" is not checkable from git (same commit as the
   cartridge). No remaining spec or code text claims a Lantern schedule or wait; hits are
   history (evidence, reviews, decisions), design explorations, and kernel tests on the ferry
   fixture.
3. **branch().** Probe against the owner's table typed by hand: all 12 starts and last minutes,
   plus 22:59, 23:00, 00:59, 01:00, 00:00, 23:59:59 and a day wrap, all correct, labels included.
   Mutants: 子 from 00:00 and `Math.round` hours killed; table swaps survive (A2).
4. **Drain.** `<=` to `<` on due time (`kernel/ts/src/proposal.ts:256`): 11 kernel, 7 mobile
   failures. Drain skipped: 25 kernel, 9 mobile (`local_story.test.ts` "jobs survive a restart",
   touch "an NPC who leaves", recipe time-cost replay).
5. **Scope.** No change under `kernel/ts/src`, `lib`, or `proposal.ts`.
6. `bin/check_all.sh` at `15226fe`: exit 0.

Over-engineering: none found; the diff is mostly deletion.
