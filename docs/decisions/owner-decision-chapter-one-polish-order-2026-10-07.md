# Owner decision: Chapter 1 polish phase and release-candidate certification order — 2026-10-07

(paraphrased) The owner plans a long, iterative UI polish and feedback round before release, and it may change mechanics. The owner approved this order:

1. **E1 ends at "coverage complete":** every applicable authored path has an exact witness or a reviewed disposition, the recorder gives a defined pass result, review is independent and hosted CI is green. Then #288 merges and E1 closes.
2. **E2**, the R9C interaction proof, follows as planned.
3. **Chapter 1 polish phase:** open-ended UI polish and feedback iteration. Each mechanic change is a normal reviewed slice, and the E1 recorder shows the paths it touched (a path pending again or a case failing). Owner feedback is logged as Beads issues with the label `ui-feedback`. UI-only fixes may land at any time in their own slice. Mechanic-changing feedback waits until E1 coverage is complete.
4. **Release-candidate certification** on one frozen source: the E1 recorder at zero pending, the final selected-v042 10,000-sequence proof, the Fable gate audit (done before the freeze, so any fix does not force a re-run) and exact-head CI. These steps move here from E1.
5. **E3**, the R10 browser content gate, runs on that same candidate, then release.

Reason (paraphrased): the final certification steps certify one exact source, so doing them before a long polish that changes mechanics would force a repeat. The witness coverage is what makes the polish safe.
