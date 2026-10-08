# E1 training/social circuit independent review

**Verdict: APPROVE.** No open findings. Review source `bc22d4335b614cb13d09f22ca1725d3f1ad9d5e0` against `24e752bec256ce45300aeefaa0aa7f27cd4eee58`; evidence supplement `6029cac73da4bfa82be1f86c39c3e0c49f47b610`. Local integration review; PR not yet assigned. Reviewer authored none of this source.

Requirements derived from [E1 policy](../system/architecture.md#e1-exact-candidate-proof-policy) and [E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md): fresh legal authority actions; independent literal outcomes; actual selected choices rather than offered-action coverage; real SQLite cold reopen and semantic replay; explicit pending obligations; no native or owner-save operations.

The route selects Hill-folk, pays authored lessons and ferry fares, acquires the original training sword, and executes eighteen literal choices. Pending continuation source is checked before choice; each conversation opens and completes across cold reopens. Lesson flags and sword custody are checked after reopen. Source content independently supports player balance 10 (20 minus lessons 8 and outbound fare 2), Peg 22, Tobin 4 and Sedge 4. Route commands pass actual authority admission; elapsed input uses the existing trusted clock helper. Recorder registration and source digest include the new route. Existing witness rules remain unchanged, including pending skill-acquisition sequence rows.

Independent checks in an isolated review worktree:

- `mise exec -- node --test kernel/ts/test/e1_dialogue_circuit.test.ts`: exit 0, 1/1.
- Temporarily omitted Gareth's ordinary conversation from the route: the same test exited 1 on missing literal `gareth/leave`. The mutation was restored before further checks or commit.
- `mise exec -- node --test kernel/ts/test/e1_dialogue_circuit.test.ts kernel/ts/test/e1_cases.test.ts`: restored exit 0, 9/9.
- Inspected [author evidence](https://github.com/lorecrafting/lokacore/blob/4c1bb174b603e16f425b21a7752c576939bcf1db/docs/evidence/2026-10-07-e1-dialogue-circuit/README.md): the omitted-Ash mutant passes 27 existing E1 tests and fails the new test, establishing its distinct break. Independently verified all nine retained SHA256SUMS entries at the evidence commit.

Ponytail Review: lean already; existing authority, replay and witness helpers supply the machinery. Correctness review found no false coverage or hidden state writer. The evidence correctly labels its remaining-count comparison as conditional on integration, not an integrated recorder run.

This approves the bounded route addition. Full local gate, integrated recorder, exact-head CI, final 10,000 candidate sequences and E1 certification remain the parent integration's responsibilities; no E1 pass or browser/native proof is granted here.
