# Review: Gate R6P (slim checklist)

- PR: #114, branch `r6p-gate`, commit reviewed `bf6b95f`; base `main` 64a2b12
- Reviewer: fresh Claude Code agent (Opus), the one checklist reviewer of the
  [slim gate](../decisions/owner-decision-slim-gates-2026-10-02.md); authored none of the work. The
  codex Astra audit of `mobile/authority/local-story` is separate; the PM appends it.
- Gate record: [human proof and checklist](../evidence/2026-10-02-r6p-human-proof.md)
- Verdict: **FAIL** at `bf6b95f`. It becomes PASS WITH NOTES when G-1 and G-2 land (owner item G-1).

## What must be true (from pre-release-proof :82-88, before the diff)

1. A non-developer completes both paths by touch, explains each consequence, quits at a choice and
   resumes in airplane mode, all without developer instructions; confusing interactions and
   authoring effort recorded; LLM or Simulator walks not counted.
2. On the iPhone 11: build and cartridge hash, OS, device, conformance profile, both transcripts,
   save/restore, latency and input responsiveness; faults before/after commit and at the narration
   boundary; a lost response replays after the choice is gone; no reroll on a duplicate.
3. Known answers run on the real adapters; per-step diagnostics carry canonical bytes.
4. The played build is the measured build. Each item is linked, or listed DEFERRED, NOT PASSED
   with a landing row.

## Checklist

| # | Item | Result |
|---|---|---|
| 1 | Evidence links | Every :86/:88 row links to R/P lines that hold it (spot-checked R:15-33, R:40-49). Build sameness: `git diff --exit-code 73927a1 origin/main -- kernel lib mobile protocol cartridges` exits 0. Authoring effort: #100 13 files +290, #107 +3 −3, #110 5 files +21 −22, reproduced from the merges; accepted, time spent null. Conformance profile null: accepted. No spec defines a profile (`git grep` finds only :86), so there is nothing to defer. |
| 2 | :84 human proof | Not met (G-1). |
| 3 | Closure and carries | R6P row (ROADMAP:53) lists #97-#113, the same set as `git log --merges bfc1b89..64a2b12`. Carries a-g and U7/U8 each sit once in a stage row (`git grep`). The gate record and the DEFERRED list only point to them. The R6P-tag sweep finds only `target.ts:34` and `smoke.ts:32` as shortcuts, both carried (f, d). Confirmed: P4a index-only loss is in SM2 (:51); presenter-boundary S1 is fixed (:55). Gate-review link missing (G-2). |
| 4 | #110 Untime fixes | Closed, see below. #110 counts as merged with its review. |
| 5 | Docs tidy | Dispositions in the PR description are correct. `world-parameters.md:3-7` keeps only doc-specific facts and links AGENTS.md:40 (anchor resolves). CHECKS "seeds 1-19" matches R:43. lessons/mobile walk selectors are current. Stale fact in the gate record (G-3). |
| 6 | Decision records, WORKFLOW | The slim-gates record, WORKFLOW "Milestone gate" (:107-116) and WORKFLOW:19 ("Astra on the gate audit") agree. The M1 record and the ROADMAP "Quest from dialogue" row agree (planned count 48). Each fact is stated once; the PM notes repeat the row by brief. |

## :84 ruling, clause by clause

"Without developer instructions" governs the whole sentence.

- **Each choice path by touch: not met.** On leave the owner got stuck, and the PM sent the full route
  and "the gate does not open by touch" (gate record :50). Carry was played with the route known.
  The owner cannot redo this unaided, because the route cannot be unlearned. Getting stuck is the
  real finding: the lantern is hard to find, and the gate is Q-3 in the R7/R8 row.
- **Explain its consequence: not met.** The PM's question pointed at the Landing. The owner read back
  two text lines and explained nothing in their own words (:51). The owner can redo this cheaply:
  without a pointer, say what each ending changed.
- **Quit at a choice, airplane resume: met with a recorded limit.** The PM's procedure named the
  scenario to test (the test protocol). It did not help operate the game, and the resume needed no
  further help. R row 13 was not rerun, so G3 is the only proof on the measured build.

## Findings

- **G-1 blocker, `docs/ROADMAP.md:53`** (the DEFERRED, NOT PASSED list) and gate record :12-13. The
  list names only touch-to-photon, so two unmet :84 clauses go unlisted. If the gate merges as is,
  the stage reads Done while unaided completion and consequence were never shown. Fix: (a) add
  "unaided completion of both paths by touch and an own-words consequence, by a non-developer
  tester without exposure" to the list, with a landing row (Playtest, or before the first release);
  (b) the owner accepts that deferral (owner item); (c) optionally the owner redoes the
  consequence part, and the PM records it paraphrased.
- **G-2 should-fix, `docs/ROADMAP.md:53`**: no link to this review (the PR description defers it to
  fix round 1). Without it, the closed stage points to no gate verdict.
- **G-3 should-fix, `docs/evidence/2026-10-02-r6p-human-proof.md:65`**: "the record has no re-review
  section". bf6b95f appended one (untime review :88-108). A reader of the gate record gets the
  wrong state. Fix: "fix round and Sol re-check appended at the gate; no Opus re-check (Gate R6P
  review)".
- **N-1 nit, gate record :29**: the tidy-pass proof is "the gate PR's description", which is not in
  the repo. Fix: link this record (checklist row 5).

## #110 Untime fix scope check (467056a, 59cca1c, 15629d1)

- **A1, closed by owner ruling.** 467056a states at pre-release-proof :59 that the Lantern's way out
  of 0 MV is Start over. That is one of the record's offered fixes, and the owner set it in the
  untimed-Lantern record (864e6e2, starting MV 100). The asked exhaustion-then-recovery test is moot
  because no recovery mechanic exists. The 0 MV refusal is pinned by `mobile/app/book/model.test.ts:137`
  (#112). :59's quote "You are too exhausted." matches `kernel/ts/play/text.ts:265`. The :41 edit
  (Sol U2) is wording only.
- **A2, closed.** A literal 12-row table plus edges. Mutants run in a throwaway worktree at main:
  swapping 午/未 in the glyph string fails the test, and so does swapping Monkey/Rooster in `ANIMALS`.
  Unmutated: pass.
- **N1, closed.** The comment now says "NPC-moves-away variant of". Comment only.
- 864e6e2 (cartridge and fixture hash) was outside the findings. Sol re-checked it, and its hash
  `9b096943…2821` is the one the P6 rerun measured on the device.

## For the owner

Accept or reject G-1's deferral of unaided completion and consequence to a tester without exposure.
Optionally restate the consequence of each ending in your own words.

## Fix round 1 re-check (head `49074d7`)

- **G-1, fixed.** ROADMAP:53's DEFERRED, NOT PASSED list now names unaided completion. The Playtest row
  (:58) carries it once as its landing: a fresh tester before the first release. The owner's
  acceptance is recorded, paraphrased, at gate record :55-56.
- **Consequence clause, met with a recorded limit.** The owner's own words ("carry (leading) meant I
  went with the party; leaving meant Bram's party goes out") name who leads the search in each
  ending, which matches `search_plan` `player_led` / `party_led`. Limits: they do not mention who
  holds the lantern, and the owner gave them after the earlier Landing prompt.
- **G-2, G-3, N-1, fixed.** The R6P row links this review; gate record :65 says "re-check in the
  record"; checklist :29 links this review.
- **S-1 should-fix, gate record "Gate passes only after the save fix"**:
  - **The base claim is wrong.** "The fixes touch only the load, replay and recovery paths …, not what
    the owner touched by hand" contradicts itself. The owner's G3 resume (reopen after a kill) runs
    `store.ts` load, which R6P-A02's fix changes. A04 caps the log the owner reads.
  - **It asserts facts not yet true.** "R6P-A01 is fixed there" is stated as done. `origin/r6p-savefix`
    does not exist yet, so neither claim can be checked.
  - **Failure:** the gate merges stating the human proof covers the gate build's paths, when the
    resume path changed after the play.
  - **Fix:** say the gate build differs from 64a2b12 in the load path G3 exercised and in the log
    length. Let the r6p-savefix review state which device rows it reruns on the new hash, or record
    that it reruns none, as a limit. Write "R6P-A01 is to be fixed there".
- The rest of that section is accurate. The audit is FAIL with three blockers and one should-fix.
  P4A-2 is a different case from A01 and stays with R12.

**Verdict: PASS WITH NOTES once `r6p-savefix` merges with its review and S-1 is fixed; FAIL until then.**
