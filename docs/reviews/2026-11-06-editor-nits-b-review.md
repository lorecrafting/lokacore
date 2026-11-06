# Review: editor nit batch B, cards, lint and content-report nits

- PR: #678 `fix/editor-nits-b-2026-11-06`
- Reviewed commit: `0719331cf346b664e8a8124579c2d3c053de2263`
- Governing: [cartridge.md orphans and write sites](../system/cartridge.md) (:590-600),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance), the PM's card bar (a card never offers or writes what the
  compiler refuses; author-error guards are nits)
- Independence: authored none of the slice; detached worktree `rev-678`
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (9 findings)
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. No card adds or writes a field the compiler refuses for that doc and cartridge: each gate has a compiler twin.
2. Adding a resource pool writes what the compiler reads as its defaults.
3. A deposit's `account` is a fact write site, so it is not an orphan read.
4. A nested-choice lint finding names a real file plus the dialogue key.
5. The World code moves without any change in behaviour. Tests pin literals the code does not compute.

## Checks that held

- `allowed.ts:53-59` matches the compiler both ways: `affects` follows derived.ex:77, and bandage follows bleed.ex:88-91.
- `ma: {}` compiles, because resources.ex:15-19 merges the defaults at :218.
- `reach.ts:29` matches services.ex:11, and cartridge.md:597 is updated.
- world_card.ts is a verbatim move plus `newEntry`.
- The lint path for `scenes/hal.scene (hal_stay)` holds.
- Merging with #677 (`e539ebd5d`) is clean (`git merge-tree`, tree `fae0e5538`), with no conflict in panel.test.ts.
- PR claims rerun:
  - dropping `items.container` gives `actual: [ 'container' ]`, as claimed;
  - `reach.ts` `(fact|account)` → `(fact)` turns content_graph.test.ts red.

## Mutants

`bin/mutate_diff.sh` was not rerun because load was high (per the brief); the handback reports 46 red-narrow rows. I ran six hand mutants and five were killed:

| Mutant | Result |
|---|---|
| `allowed.ts` bandage container check dropped | killed |
| `reach.ts` account dropped | killed |
| `world_card.ts` newEntry pools `{}` → blank | killed |
| `write.ts` sceneText `_` separator dropped | killed |
| `lint_layout.ex` `split_with(&!File.regular?…)` | killed (3/4) |
| `lint_layout.ex:52` `max_by` → `min_by` | **survived (4/4)** |

## Findings

1. **should-fix**: `tools/author-panel/src/edit/Generic.tsx:176` and `:182`.
   - The card writes what the compiler refuses. `AddMenu` now commits `adder`'s least value, but the Generic path has no capability filter (`allowed` with caps), and the command action routes to it (`Action.tsx:27`).
   - Repro:
     - In a cartridge without `policy@1`, add `policy` to a command action. The card writes `{"op":"all","items":[]}`.
     - Then `mix loka.compile` exits 1 with UNDECLARED_CAPABILITY at `actions/<a>.policy.op`. I reproduced this on a copy of build_sampler.
   - Before the PR the field was only revealed and nothing was written.
   - Other `right.tsx:119` fallback directories with a gated field share the gap; I did not check this.
   - Fix: filter the Generic menu through `allowed(dir, …, caps, draft, cart)`, or keep reveal-only for fields that are not gated.
2. **should-fix**: `lib/loka/content/lint_layout.ex:52`. Nothing tests the "longest real parent" tiebreak.
   - Scenario: real `a.scene` and `a_b.scene`, where `a_b`'s nested `c` yields `a_b_c`. With `min_by`, the finding is reported against `a.scene`.
   - Fix: add a second real parent to content_lint_layout_test.exs:94.
3. **nit**: `kernel/ts/play/allowed.ts:53-59` reads the raw draft (`Entity.tsx:58`), not the doc with `extends` resolved (extends.ex:3).
   - A child of a slotted or container parent is offered `bandage`, which the compiler refuses.
   - It is also not offered `affects`, which the compiler accepts.
   - This follows the existing `items.weapon` pattern and is an author-error edge.
4. **nit**: `kernel/ts/play/write.ts:198` and `lint_layout.ex:49`. A real `<key>_x` dialogue is taken for a nested child of `<key>`.
   - It is disclosed, and no cartridge has such a pair.
   - Accept, and file it in Beads; the cure needs Source to record each nested dialogue's parent.
5. **nit**: `kernel/ts/play/action.ts:25`. `scriptedMenu` now also builds the command menu, so rename it (for example `menuOf`).
   - Also have `Action.tsx` import `adder` from Generic and drop the `Room.tsx:141` re-export.
   - `World.tsx:133` `newEntry` and `Generic.tsx:53` (the load failure goes to `setRefused`) are fine as they are.
