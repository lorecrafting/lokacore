# E1 presentation-only dream witness independent review

Dream witness source: `3d33413033f589928cd42a81bccad7768d2ab040`; negative-oracle test fix: `8373c0f3`; combined recorder source: `178d02909bb4a66f2135bf55eeff8015836820cd`; evidence checkpoint: `26ae4304`.

Initial review found one test gap: the first version did not inspect Rest, which first displays the dream. Since the scene-definition witness is deduplicated and also earned at the first Continue, an erroneous early credit could survive the replay's final-set assertion. The scoped test fix adds a no-witness assertion on the accepted Rest display in each branch and requires exactly one such display. The premature-Rest-credit mutant leaves the prior five cases green and fails the new test. The fix closes this finding.

**APPROVE** the bounded dream binding after that fix, no remaining findings. E1 remains pending; this review does not grant certification.

## Review

- The helper first requires an accepted decision. For Continue it derives the line from the current bed-local dream and requires the command line and scene key to match. For Choose it requires a pending scene-owned continuation, dream choice state at beat 4, the same continuation, an accepted selected branch in the after-state, and a choice index present in the offered options. The installed `continueQuery`/`chooseQuery` also validate safe anchor, exact scene reference, line and drawn choice state before acceptance.
- Witness mapping matches S10 and cartridge B9: Continue on visible beat 1 witnesses the scene and step 0; Continue on beats 2–3 witnesses steps 1–2; accepted Choose witnesses the choice beat and only its selected option; Continue on the selected final line witnesses step 4 and the structural `await_ack`/`end` steps only when the dream index reaches -1. Offered choices and initial display earn nothing. Both literal branch indexes are covered.
- The focused real-SQLite tests independently passed 7/7 on combined source `178d0290`; typecheck passed; docs check reported 829 documents, 0 broken links and 0 unreachable files. I also ran the five existing E1 case tests plus the dream test before the negative-oracle fix, and verified the Rest mutation's retained five-pass/one-fail logs after the fix.
- The combined clean-head report binds source SHA `178d0290`, check digest `99ef5eb8…`, candidate content hash `5d8b0e3a…`, and policy hash `02d71791…`. All 18 real SQLite cases and semantic replays pass; the command exits 2 with a null certification verdict. The two dream receipts witness all ten dream-scene paths. The report leaves 34 dialogue families, 47 choice families, 29 recipe paths and 428 authored obligations pending. It does not certify E1.
- The retained combined `SHA256SUMS` verifies. The saved `case-SHA256SUMS.verify` records success for the full isolated output, including its databases; only selected traces are committed. Privacy scan found no local/scratch paths or restricted device, team or provisioning identifiers. Source/docs edits are append-only; no archived history was rewritten.
- Ponytail review: minimal. Dream witnesses reuse the existing E1 case host, GameView projection and semantic replay; the fix adds only the missing negative assertion. No new dependency or abstraction.

## Limits

This approves only the presentation-only dream witness mapping and its negative oracle. The combined source also contains a separate recipe-policy binder, which is outside this review. The remaining authored obligations, final candidate review, selected 10,000-sequence proof and E2/E3 browser receipts remain pending.
