# Chapter 1 aggregate docs and Beads — independent review

Reviewed frozen local integration head `822c1c066902c263bdd31c712fdd8a0fe0f04125`
against published `upstream/main` `536c80bc76882839465aecc330e22e891e1e137d`.
Fresh reviewer; authored none of the reviewed docs or tracker updates. This is a
documentation/status review before publication, not source implementation approval.

**Verdict: CHANGES REQUIRED — C1A-1.**

## C1A-1 — should-fix — completed list and latest publication contradict D4 status

`docs/ROADMAP.md:167-169` now says **19 of 33** completed, but its parenthesized
list contains only 18 slice codes and omits D4. The next sentence still calls
#231/D1 the latest source publication, while the new D4 section at lines 319-328
correctly records merged #233 as the later source publication. A reader using the
roadmap's lead status cannot identify the nineteenth completed slice and receives
the wrong latest publication. Add D4 to the list and update the latest-publication
sentence to #233/D4. Keep D1's detailed historical record below.

## Other reviewed boundaries

The Beads export has 33 unique Chapter 1 issues: 19 closed, 10 open and four in
progress (C4, D3, D6, D12). The closed D4 issue agrees with #233; the four
in-progress issues are not counted complete. The D6 selected contract and scoped
fix review restrict Chapel recovery to actual owned nonempty underwater corpses,
preserving D1's isle corpse fare waiver and physical recovery. D12 pins the
literal careful invocation, conserved two-ID harvest and bound current quote;
D3 retains the Boathouse ferry/east edge while adding the south mill route. These
are planning contracts and provisional work, not installed source proof.

`mise exec -- elixir bin/check_docs.exs` exited 0: 662 docs, zero broken links and
zero unreachable. `python3 bin/check_beads_export.py` and `git diff --check`
both exited 0. No source tests, fixtures, browser, device or owner save changed.

Ponytail Review (docs/board scope): the status defect comes from duplicating the
completed/latest publication summary within the roadmap. Correct the existing
two sentences; no new status layer or checker is needed. No separate complexity
finding. Lean already. Ship after C1A-1 is fixed.

## Scoped C1A-1 recheck — APPROVE

Reviewed the one-file fix at local integration head `cf9d357f` against frozen
`822c1c06`. **APPROVE — C1A-1 closed; no remaining findings.** The roadmap's
completed list now has all 19 slice codes including D4, and its latest-source
sentence names merged #233/D4. The later D1 and D4 records retain their
historical detail. The fix changes only those two sentences; the already
verified Beads count and selected planning contracts are unaffected. This
approval covers documentation/status publication only, not provisional source.
