# E2 slice plan: R9C interaction proof, `loka-e2-r9c-interaction-proof-2cv`

Owner-approved 2026-10-07 ([answers](../../decisions/owner-decision-e2-plan-2026-10-07.md)); copied from the PM draft without its local path lists. The owner questions below are answered in that record.

**Summary**
1. There are 6 slices: S0 (runner accepts a second candidate), S1 (synthetic cartridge and its known answer), S2, S3 and S4 (scenario groups), S5 (closing proof), plus a docs-only gate PR (G).
2. Pairs that can run at the same time: S0 ∥ S1, then S2 ∥ S3, then S4 alongside whichever of those is still open. That is never more than two developers at once (WORKFLOW:262-263).
3. Biggest blocker: the E1 runner only accepts the real chapter today. S0 must amend that, or E1 #288 must ship the change.
4. Owner questions: (a) browser rows, (b) what counts as the owner's play or test for this gate, (c) whether S1 may start before E1 closes, (d) the cost the synthetic cartridge adds to polish-phase mechanic changes.
5. Unknown until execution: the synthetic cartridge's ID, version, hash and allocation; the E1 runner's API and report revision; the simulator sequence count for the synthetic cartridge; the browser adapter; and which real reachable defect the existing tests miss.

## Goal
Build one small, permanent synthetic cartridge whose legal scenarios show that the installed A–D mechanics work together. It runs on the real compiler, loader, kernel, local authority and the E1 runner, with its own identity, separate from the chapter. Sources: brief:9, `docs/archive/spec/14-implementation-plan.md`:587, :607, :613.

The claim at the end is "applicable R9C headless/browser interaction evidence" (brief:117). It is not chapter, native or product proof (14:615, brief:26).

Base: main `294062aa`. E1 is in flight on `slice/chapter-one-e1-r9-certification@23ff4aab`.

**E1 already covers** the authored v042 paths: witnesses, dispositions, real SQLite receipts and the recorder (`architecture.md@23ff4aab`:162-401).

**E2 adds only what E1 does not have:**
- cross-mechanic compositions, including legal forks the chapter never reaches;
- a planted interaction defect;
- a second candidate under the same runner.

Wherever an E1 receipt or a focused composition test already catches the same break, link it instead of adding a test (brief:32, brief:75; AGENTS.md:122-125).

## Exit criteria (each tied to its clause)
1. **Admission.** The compiler and loader admit the independent artifact, and the hash and allocation match an independent oracle. Static malformed or unknown use is refused before anything changes. No existing fixture is retargeted. (brief:101; `docs/system/cartridge.md`:324-349)
2. **Seven scenario families** run through the real kernel. Durable steps also run through the real authority and SQLite, reopening at every committed intermediate state before the next consumer. Results, state and RNG are compared against literal values, then replayed. (brief:57-70, :102; 14:607; `save.md`:85)
3. **Runner report on the synthetic candidate.** It lists each used feature and dependency, the required gates and every row's disposition. Artifact identity and engine/check identity stay separate. A capability that is locked but unused is not coverage. (brief:103; 14:611 "coverage accounting"; `architecture.md@23ff4aab`:172-186, :203-207)
4. **Planted defect.** At least one real, reachable cross-mechanic defect that the focused suite does not catch is planted in a throwaway worktree and fails a named scenario. The receipt records location, wrong result and invariant. If no such defect exists, the report says so honestly. (brief:104; 14:603, :607; AGENTS.md:126-129)
   - Not a conflict: 09 §1a:84 says "mutation sensitivity not required", but that scopes the R9 chapter minimum, not R9C.
5. **Guard sensitivity** for the five named breaks, reusing existing failing checks where they already exist. (brief:105)
6. **Real SQLite faults** on representative cross-domain commits: failed write, failed COMMIT, lost acknowledgement, and a kill before and after commit. Every partial transaction stays fenced, and a duplicate retry with the same payload applies once. (brief:106; 14:611 "crash/retry"; `save.md`:85-107)
7. **Browser rows** either compare to the Node results or are recorded as named pending rows. Hermes and native rows stay pending. (brief:107, :26; open question (a))
8. **Standing regression corpus.** The suite runs in the normal `typescript` CI job and `bin/check_all.sh`, and exact-head CI including `sim` is green. (14:613; brief:109)

## Rules for every slice
- **Copy the scope rules into every brief:** no new engine features, no second command actor, no interpreter or matrix, no synthetic mobile UI, no LokaScript, no InstancePlan, no ServiceJob (brief:34).
- **Stop triggers** per brief:115. A mechanic defect goes back to its owning slice as the smallest repro.
- **Assertions** use action keys, GameView fields and text keys. They never use rendered copy or styles, so designer token or copy changes cannot break E2.
- **Content freeze:** S1 authors the complete synthetic content for all seven families. S2, S3 and S4 must not edit `cartridges/<synthetic>/` or its oracles. A content gap found later becomes one serialized content follow-up: choose the integration order, then derive the new pin (WORKFLOW:265-269).
- **Lessons to read first:** `docs/lessons/{contracts,storage,evidence,mechanics}.md`. Every brief includes the composition record (WORKFLOW:70).

## Slices

**S0. E1 runner accepts a named second candidate (spec first)**
- Sections: `architecture.md` "E1 exact candidate proof policy", amending :167 ("accepts only the current bundled candidate"); `future.md`:52 (R9C).
- Files: `kernel/ts/test/e1_policy.ts`. Make `CANDIDATE` (:11-15) a two-entry literal table and keep the refusal at :86-87. Also `e1.ts` (argument selection) and the spec text. Skip the slice entirely if E1 #288 already ships this (brief:80-81).
- Developer: Opus (certification contract). Review: one fresh Opus. I recommend the PM add a second opinion, because this changes the policy E1 closed with two reviewers (WORKFLOW:39-40, "PM may add").
- Acceptance:
  - both candidates are admitted only with their exact ID, version and hash;
  - E1's `wrong-candidate` red control still refuses;
  - a candidate with no table row refuses;
  - v042 outputs are byte-identical to E1's (an E1 receipt still resolves).
- Red control: delete the hash comparison and the wrong-candidate test fails.
- Depends on: E1 #288 merged.

**S1. Synthetic cartridge source, artifact and independent known answer**
- Sections: `cartridge.md` "Development cartridges" (:367), plus "Artifact and loader"; the owning `mechanics.md` clauses for B8, B9, C3–C5, D1, D7, D8 and D12 (brief:44-55).
- Files:
  - `cartridges/<synthetic>/` (`r9c_interactions` is a proposal);
  - `protocol/fixtures/cartridge_<synthetic>_hash.json` and an allocation oracle;
  - `test/loka/cartridge_<synthetic>_hash.py` (independent oracle, brief:30);
  - any loader/compiler admission test lines;
  - the `cartridge.md` entry.
- Developer: Opus (contract freeze, independent answers). Review: one fresh Opus.
- Acceptance:
  - the compiler and both loaders admit the artifact, and the cross-kernel byte, hash and lock comparison holds;
  - the short references expand;
  - a malformed or unknown-capability variant is refused before any world exists;
  - historical fixtures are unchanged;
  - the entities support all seven families with shared topology.
- Red control: mutate one authored value and the independent oracle fails.
- Depends on: nothing in E2. It needs `chore/code-fixture-hygiene` merged or re-pinned, because that branch touches `test/loka/`. Assignment waits for E1 unless the owner answers (c).

**S2. Families 1–2: identity, custody, trade, terminal fork, final acknowledgement**
- Sections:
  - `protocol.md` Target resolution :300, ActionSet and admission :226, GameView :309;
  - `save.md` Story points :177 and Narration on reopen :170;
  - `book-ui.md` Live action freshness :92 (read only).
- Files (new only): `kernel/ts/test/r9c_custody_terminal.test.ts` and `mobile/authority/local-story/r9c_custody_terminal.test.ts`.
- Developer: Opus (kernel, authority and save). Review: one fresh Opus.
- Acceptance:
  - the brief's family rows 64-65 with literal state and RNG;
  - reopen at every intermediate state;
  - replay cannot switch the outcome or credit it twice;
  - a still-offered action survives an elapsed redraw, checked view to invocation.
- Red controls: allow a mutually exclusive terminal change; export before final acknowledgement; move memory before a failed COMMIT. Reuse existing checks first.
- Depends on: S1.

**S3. Families 3 and 5: paid Rest, dream, liquid, light; patrol and deer job ordering**
- Sections: `protocol.md` B8 :954, B9 :1013, B7 :666, B4 :621, C2 :719, D7 :1199; `save.md` Durable elapsed sessions :231.
- Files (new only): `kernel/ts/test/r9c_elapsed_jobs.test.ts` and `mobile/authority/local-story/r9c_elapsed_jobs.test.ts`.
- Developer: Opus. Review: one fresh Opus.
- Acceptance:
  - brief rows 66 and 68;
  - time does not pause for payment or dream;
  - quantities are conserved;
  - equal-time continuations keep the paired-job completion invariant.
- Red control: remove a source custody debit.
- Depends on: S1.

**S4. Families 4, 6 and 7: hound, bleed, escort, expedition; crow provenance; skill, water, ferry, corpse**
- Sections: `protocol.md` C3 :804, C4 :875, C5 :1207, C6 :1264, D8 :1277, D1 :916, D6 :1107, D12 :1188; `save.md` Escort recovery :362.
- Files (new only): `kernel/ts/test/r9c_creatures_transport.test.ts` and `mobile/authority/local-story/r9c_creatures_transport.test.ts`.
- Developer: Opus. Review: one fresh Opus.
- Acceptance:
  - brief rows 67, 69 and 70;
  - a rejected input draws no RNG, and an accepted failed roll draws exactly once;
  - no minted loot, no stale route credit, and the original identity is kept.
- Red control: omit provenance or the population cap.
- Depends on: S1.
- This is the largest slice. If it runs past about two days, split families 6 and 7 into their own slice (S4b).

**S5. Closing proof: fault schedule, runner report, planted defect, browser rows**
- Sections: `save.md`:85-107; `architecture.md@23ff4aab` E1 policy; `docs/lessons/evidence.md`.
- Files:
  - one new `mobile/authority/local-story/r9c_faults.test.ts`;
  - `docs/evidence/<date>-e2-r9c/` (report, mutant diff, red/restore logs, SHA256SUMS);
  - the brief/review index lines.
- Developer: Opus. Review: one fresh Opus plus a second opinion, because this closes the gate (WORKFLOW:37-40).
- Acceptance: exit criteria 3, 4, 6 and 7, then the coverage table and handoff (brief:117).
- Search order for the planted defect, from brief:104:
  1. a due-job generation read happening before an earlier reaction;
  2. payment conserved while the liquid source is not debited;
  3. a death-separated follower still granting route credit.
- Depends on: S0 and S2–S4.

**G. Gate PR (docs only)**
- Contents: the checklist, the docs tidy pass and the ROADMAP E2 row. Developer: Sonnet. Review: one reviewer, no second review (WORKFLOW:324).

## Which slices can run in parallel
- **S0 ∥ S1:** S0 touches `e1_*.ts` and `architecture.md`; S1 touches `cartridges/`, `protocol/fixtures/`, `test/loka/` and `cartridge.md`.
- **S2 ∥ S3 ∥ S4:** each adds only its own new files. Run two at a time; each gets its own reviewer.
- **Serial:** S5 after all of them; G last.
- **Shared index files:** the `docs/reviews/README.md` lines use the union merge.

## What the designer's foundation pass must not touch
E2 makes no Book changes, so no designer consultation is needed (WORKFLOW:249, :260). The designer's `design/book-foundation` branch (clean at `294062aa`) must stay out of:
- `kernel/**`, `mobile/authority/**`, `protocol/**`, `cartridges/**`, `test/loka/**`, `bin/**`;
- the logic and output of `mobile/app/book/{presenter,model,offers,logs,pages}.ts(x)` (action keys, ordering, invocations, GameView mapping);
- the rule clauses in `docs/system/book-ui.md` (Live action freshness :92, the Chapters/scenes/recovery and Shared elapsed sections, and the per-mechanic action rules);
- `protocol.md` GameView and `.github/workflows/book-e2e.yml`.

Tokens, the specimen, `BOOK-UI-COMPONENTS.md` and the visual sections of `book-ui.md` are free.

## Gate (E2 closure)
- **Fable audit** of the riskiest code, done before G merges (WORKFLOW:12, :25, :323).
- **Checklist PR (G)**, checked by one reviewer: every spec proof linked, every carry in a stage row, and the docs tidy pass over docs changed during E2 (WORKFLOW:324-328).
- **Owner's play or test:** E2 has nothing touchable (no UI), and WORKFLOW:322-323 asks for play or test only "when the stage has something touchable". See question (b).
- **Exact-head hosted CI** green; auto-merge on the required `ci-green` and `book-e2e-green` checks (WORKFLOW step 7).

After E2 closes, the polish phase can start (`owner-decision-chapter-one-polish-order-2026-10-07.md`:6-7; ROADMAP:56-58).

## Open questions and decisions
**For the owner:**
- **(a) Browser rows.** The preview bundles only the chapter (`docs/web-preview.md`:1-3), and synthetic UI is out of scope (brief:34). Should browser rows be "named pending: no harness loads a non-bundled artifact", or should E2 add a minimal test-only browser load path?
- **(b) Gate touch.** Watch a headless S5 run or report, or skip the owner's play for this gate?
- **(c) Early start.** May S1 (content only, no E1 interface) start before E1 #288 merges? By default, no (brief:5, :80; the Beads dependency).
- **(d) Polish cost.** During the polish phase, a mechanic change that breaks synthetic answers is fixed in that same slice (14:613). Confirm you accept this cost.

**For the PM:**
- Synthetic ID and version (decide at S1).
- Whether to run the simulator on the synthetic candidate, and the sequence count. The 10,000-sequence run moved to release-candidate certification.
- Whether S0 is needed at all, depending on what #288 ships.

## Risks (riskiest code named)
- **Runner candidate gate** (`e1_policy.ts`:11-15, :86-87). Widening it could weaken the wrong-candidate refusal. S0's red control covers this.
- **Code under the most stress:**
  - `kernel/ts/src/runtime/proposal.ts` and `world.ts` `step` (writer groups and due-job pairing, the first candidate for the planted defect);
  - `mobile/authority/local-story/{authority,save,store,finale-save,elapsed}.ts` (fence, reconcile, story point).
- **In-flight overlap:**
  - `chore/mobile-size-debt` rewrites `save.ts`, `store.ts`, `finale-save.ts` and `narration.ts`;
  - `chore/code-fixture-hygiene` deletes about 10k lines under `test/loka/`.
  - E2 should start after both merge, or re-pin to them.
- **No new detection.** Duplication with E1 witnesses and the focused composition tests (`crow_composition`, `bleed_composition`, `encounter_composition`, `c4_pack_composition`) may leave no new defect to find. The brief allows reporting that honestly.
- **Scope creep.** The cartridge could grow into a second product, or a locked capability could be counted as coverage without being executed (brief:113).
- **Content gaps** found in S2–S4 force a serialized re-pin of S1's content.
- **Estimate:** 3–5 developer days plus 1–2 review/fix days (brief:95-96), roadmap lift 0.6–0.9. Not measured.
