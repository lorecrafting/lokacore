# Review: status readers SR1 to SR3 (loka-kgd.86, .87, .88)

- Branch `toolbox/m8-readers`, head `0a8930485cfbc557ffac8814d42cac6f81acc450`, diff against merge-base `347bd600` with `origin/toolbox/batch-m8` (46 files). No PR (batch model). The developer's `/code-review medium` result is in the Beads `loka-kgd.86` notes. This is a contract slice (new event, trigger, reaction step and policy enum value; `kernel_api` 1.53), so this record is kept. Expect a `kernel_api` conflict with harvest 19a (1.52) at merge. Keep 1.53; this is not a defect.
- Governing docs: [status readers](../system/mechanics.md#status-readers-toolbox-rows-sr1-sr2-and-sr3), [status declarations](../system/cartridge.md#status-declarations), [reaction@1 subject table](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), G3 Events and writer groups, survey section O (`2026-10-10-status-effects-survey.md`).
- Hosted ci and book-e2e are green on the head (`gh run list --commit`).
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix, two nits).

## Must be true (written before reading the diff)

1. `self` is the actor's body in any policy. `subject` is the reaction event's subject, and only inside a reaction `when`. `target` keeps its meaning.
2. `status_applied` is emitted only when a status starts (no row, or an inactive row), once per holder, in step order. A refresh, an immune holder or a refused holder emits nothing. The event appears only when some reaction listens for it. Chapter 1 bytes and receipts stay the same.
3. A reaction `status.cure` acts on the subject, joins the holder's writer group for the advance, and reads the proposal built so far. In one rule, the first apply or cure on a holder and status pair wins.
4. Both kernels enforce the 1.53 floor for each piece and refuse an unresolved status and holder fields on a cure.
5. Every applier emits the event, or the limit is documented.
6. Cycles are cut by `reaction_depth`, and nothing commits.

## Findings

1. **Blocker: the shared once-set is untested** (`kernel/ts/src/mechanics/reaction.ts:211`). Spec: "the first of the two on one pair in a rule wins, so a rule never writes one row twice".
   - Mutant: `if (!holder || (apply && applied.has(once)))`, so a cure ignores the set.
   - Result: the mutant stays green on elements, status, npc_status, fear, exposure, reactions, status_composition, derived_status, chapters and reactions_sampler.
   - Wrong result it lets through: a wet golem and rule `[status.apply wet, status.cure wet]` on `status_applied shocked`, then the jar is dropped.
     - Head: wet stays active, with one wet transition.
     - Mutant: wet is ended, and two `status.transition` writes on the wet row are accepted.
   - Fix: add one test asserting "first wins" on a pair, for example this rule.
2. **Should-fix: the reader 2 obligation for row 29b is not recorded** (`docs/system/mechanics.md:2300`, `docs/MECHANICS-TOOLBOX.md:137`).
   - Reaction-only emission is complete today. `applyStatus` has one caller (`reaction.ts:215`) on this head, on `origin/toolbox/batch-m8` and on `origin/main`. Recipes, dialogue and G4 only cure.
   - The emission sits in `statusStep`, not in `applyStatus`. A 29b spell `status.apply` that calls `applyStatus` would therefore emit nothing, and "lightning on wet" from a spell would never fire.
   - The obligation exists only in a `loka-kgd.86` note, and no 29b issue exists to carry it (`br search 29b`).
   - Fix: add one line to Reader 2 or to row 29b: "any non-reaction applier emits `status_applied` too".
3. **Should-fix (open item, pre-existing): a wait that crosses a tick and the expiry faults.** Not caused by this slice.
   - Repro: `elements_sampler`, drop jar, then one elapsed of 120 s gives `precondition_failed` on the shocked row. 119 s and 3 x 60 s are accepted.
   - It reproduces on base `347bd600` code with the reader rules removed, so it is the open bug `loka-6ztc` (comment with this simpler repro added). It contradicts that issue's note that a crossing without a refresh is accepted.
   - Play does not reach it, because the host stops each elapsed at a pending job. It does block any test of an SR2 chain across several jobs in one elapsed.
4. **Nit: the e1 cure witness ignores direction and holder** (`kernel/ts/test/e1_obligations.ts:423`). It accepts any `status.transition` of that status.
   - Harmless: the `groups` map returns `undefined` for every status step (the fall-through at about line 487), so a rule with a status step is never credited. The clause only satisfies the typecheck and feeds the claims dedup, which can drop credit but never grant it.
   - **Decision: the PM's witness is correct for its purpose.**
5. **Nit:** there is no PR body. The `/code-review` result exists only in Beads.

## Proof

- Chain within one advance:
  - A tick reaction that applies `warm`, then `status_applied warm`, then `warmth_dries` curing `wet` in the golem's group, is accepted (60 s wait).
  - Shocked and stunned both due at 60 s, with a tick reaction that cures the other and applies `warm`, are accepted in both job orders, and the events follow job_id order.
  - The stale job after a cure completes harmlessly.
- Determinism: `status_applied` takes the rule's global position counter (`emit`, `reaction.ts:132`) in step order, and the job order is (due_time, job_id).
- Red controls (mine), focused files:
  - Failed as they should: M2 (cure not joining the group), M3 (`self` read as `subject`), M4 (opt-in `landing` dropped), EX1 (Elixir `status_applied` floor), EX2 (Elixir leaf floor), EX3 (Elixir cure reference dropped, with `mix test --force` and its own `_build`).
  - Survived: M5 (finding 1).
- Loader parity (both kernels):
  - A `status_applied` filter naming an undeclared status gives UNRESOLVED_REFERENCE at `on.status`.
  - A cure with `item` gives UNKNOWN_FIELD.
  - The floors are checked by the twin tests.
  - `invalid.json` changed by additions only.
- Chapter 1: no hash fixture changed. `chapters.test.ts` asserts the `cartridge_*_hash.json` KATs and is green.
- Claims rerun:
  - Backed: `landing` at `status/shared.ts:88`; `COMPOSES.reaction` includes status at `decision.ts:214`.
  - Question: the "equivalent" mutant at `validate.ts:95` is outside the diff and was not reproduced.
- Composition: reaction@1 composes status@1, as the spec requires. No capability code names content.
- Tests: expected values are literals, and there are no mocks.

## Re-check at e65096d9 (fix commits 86c3d126, e65096d9)

- Head `e65096d9c937e2cde93add89a9be449366f504a9`. Hosted ci and book-e2e green (`gh run list --commit`). Only the two fix commits were reviewed.
- Verdict: **APPROVE WITH NOTES** (findings 3 to 5 stand as recorded; 3 is the open bug `loka-6ztc`).
- Finding 1, blocker: **resolved.** New test `kernel/ts/test/elements.test.ts:172` ("in one rule the first of an apply and a cure on one holder and status wins"): a wet golem, rule `[status.apply wet, status.cure wet]`, then the jar is dropped. It asserts one wet `status.transition` and wet still active. Expected values are literals.
  - Re-planted M5 at `reaction.ts:211` (`if (!holder || (apply && applied.has(once)))`): `node --test kernel/ts/test/elements.test.ts` gives 7 pass, 1 fail. The failure is the new test. Unmutated: 8 pass. `npm run typecheck` (kernel/ts): exit 0.
- Finding 2, should-fix: **resolved.** Reader 2 (`docs/system/mechanics.md:2300`) now says the emission sits in `statusStep`, not in `applyStatus`, so a row 29b `status.apply` emits `status_applied` itself. Row 29b (`docs/MECHANICS-TOOLBOX.md:137`) carries the same duty. Both match the code: `applyStatus` does not emit, and `statusStep` does (`reaction.ts:221`).
- `docs/toolbox.gen.json`: the 29b entry now has the status `todo; its ...`. `bin/system_pages.exs:63` derives `state` with a prefix match, so the entry stays `todo`. The Storybook reader (`mobile/app/stories/system/pages.ts:12`) shows `status` as text. One other row already uses the `todo;` form. No consumer breaks.
