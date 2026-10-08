# Review: wave 2 docs slimming (PR #307)

- PR: [#307](https://github.com/lorecrafting/lokacore/pull/307), branch `docs/wave2-slimming`, head
  `589db5360dcdf570f50465571702367cb911fe6a` (includes the merge of `main` `4c47ab19`).
- Reviewer: fresh independent Opus reviewer; authored none of the work.
- Governing: [AGENTS.md](../../AGENTS.md) "Each fact lives in one place";
  [WORKFLOW](../WORKFLOW.md#review-stance), [milestone gate tidy checklist](../WORKFLOW.md#milestone-gate);
  [move forward](../decisions/owner-decision-move-forward-2026-10-07.md);
  [mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md).
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. Every owner rule still in force keeps its meaning and a link from owner-rules, the spec or WORKFLOW.
   A suspended rule must stay findable for when its suspension ends.
2. Every live review and decision record keeps an index line. Each removed line is reachable
   through a permalink that resolves.
3. WORKFLOW has one lanes table that agrees with step 7, the agent definitions and the batching
   preference. There is one developer-model list.
4. `check_size.exs` scans tracked files only. The TS size red control fails when ci.yml excludes `mobile/`.
5. `Accepted`/`ref` is a pure refactor. Links and anchors are clean. No new catch-all doc.

## Evidence

- `check_docs.exs` and `docs_red_controls.sh` pass. Every file in `docs/decisions`, `docs/archive/decisions`
  and `docs/reviews` has an index line.
- All 11 permalinks added by the diff resolve (`git cat-file`, both commits on `main`).
  The `#c1-slices` anchor exists at `15c7d41b`.
- The room-view owner rulings match the owner's 2026-09-25 rulings: § choices, ribbon, tide band,
  always-visible tabs, tilt and on-page sun are ruled out; the card is kept for arc markers; the
  pickup sound is a paper flick. The objective running head is covered by the
  [design foundation](../decisions/owner-decision-design-foundation-2026-10-07.md).
- The `kernel/ts` typecheck passes. Mobile `tsc` passes, and its `include` covers `../authority`.
- Local-story tests: all pass. Seven files first failed for lack of `mix deps`; they passed on rerun.
- `check_size.exs`, `red_size_controls.exs` (run via `red_controls.exs`), `check_ts_size.mjs`,
  `ts_size_red_controls.sh` and `check_beads_export.py` all pass.
- Mutants, each red with the control's FAIL line:
  - M1: `--cached --others --exclude-standard` restored in `check_size.exs`.
  - M2: the ci.yml:148 step becomes `git ls-files ... ':(exclude)mobile/**' | xargs -0 node bin/check_ts_size.mjs`.
  - M3: the ci.yml:148 step is limited to `kernel/**` and `bin/*.mjs`.
- Hosted CI on `589db536`: 7 of 7 pass (browser, changes ×2, elixir, lint, sim, typescript).

## Findings

1. **should-fix**: the F7 rules are suspended, not superseded, but are now neither listed nor
   deleted. See `docs/system/owner-rules.md:224` and `:3`, and `docs/WORKFLOW.md:201-204`.
   - The pause record says it is temporary ("restore … when the owner resumes").
   - These rules now appear only as titles in the decisions index:
     - [agent-device](../archive/decisions/owner-decision-agent-device-2026-10-01.md) UI-review walks;
     - [device rows](../decisions/owner-decision-simulator-device-rows-2026-10-02.md) (iPhone 11 at gates);
     - [simulator-first](../decisions/owner-decision-simulator-first-validation-2026-10-04.md).
   - The owner-rules header says superseded records are deleted. So an agent applying move-forward
     may delete them as superseded.
   - Failure: at mobile resume, the PM follows WORKFLOW:203, which restores only the local edit loop.
     A native gate then closes without the iPhone 11 row or the agent-device walk.
   - Fix: one clause on the mobile-pause line naming the records that resume with native work.
2. **should-fix**: there are two developer-model lists. `docs/system/owner-rules.md:203` says
   "Opus for kernel and contract-freeze slices". `docs/WORKFLOW.md:24` adds save, protocol,
   cross-layer and contract work.
   - Failure: a PM reading owner-rules spawns Sonnet for a local-story save slice.
   - Fix: owner-rules keeps the owner's default and links the routing table.
3. **nit**: `docs/WORKFLOW.md:115-116` says to mark a draft ready "before review". The lanes row at
   `:182` says slice reviews happen while the PR is a draft, and only the final review comes after
   it is marked ready.
   - Failure: read literally, step 7 makes each batch review trigger CI, against `:186`'s
     "one CI run per wave".
4. **nit**: `docs/reviews/README.md:10` and `:12` are the same "Mobile size debt" line, a union-merge
   artifact. WORKFLOW:279 asks the PM to dedupe it.
5. **nit**: `docs/system/owner-rules.md:3` says each installed PM adoption is linked from its spec
   section. That is false for
   [mechanics continuation](../decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md):
   `future.md` dropped the last spec link.
   - It is still reachable through owner-rules → Legend reconciliation.
   - Its "no hunger/thirst clock" scope is restated in `mechanics.md:977`.

Over-engineering: none found. `docs/BEADS.md` is a focused operations page, and WORKFLOW links it
without restating it. The new red-control code is minimal.

## Fix round `66ccb601` (scoped re-check)

Scope: `2de547a7..66ccb601` and neighbouring lines only
([WORKFLOW step 6](../WORKFLOW.md#loop)). `bin/check_docs.exs`: 288 docs, 0 broken links or anchors, 0 unreachable.

Verdict: **APPROVE WITH NOTES**. Nothing blocks the merge.

1. Closed. `owner-rules.md:224` names all three records as resuming with native work, and all
   three paths resolve. The hook's "second resume trigger" reading is wrong: native work starts
   only when the owner resumes it, so the trigger stays owner-resume only. The line now lists them
   as rules in force, so move-forward cannot delete them as superseded. WORKFLOW:201-204 needs no
   change.
2. Closed. `owner-rules.md:203` keeps only the owner default and links the routing table. No
   restated model list remains in owner-rules. New nit: the link is `../WORKFLOW.md`, not
   `../WORKFLOW.md#work-routing` (the anchor is at WORKFLOW:18), so it lands at the top of the
   file. The table is 5 lines below, so this is optional.
3. Closed. WORKFLOW:115-116 "before the final review" matches the lanes row at `:182` and the
   skip-CI-on-drafts record.
4. Closed. One "Mobile size debt" line remains in `docs/reviews/README.md`.
5. Closed. `owner-rules.md:3` no longer claims a spec link for each adoption; the index covers
   them.
