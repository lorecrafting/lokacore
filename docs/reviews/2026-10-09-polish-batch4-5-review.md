# Review: polish batches 4+5, page and live stories, E5, fidelity polish (PR #330)

- PR #330, branch `polish/storybook-b4`, head `ee8f0dfe`, base main `8fd7aeb3`. Beads loka-bhb. Correctness review (a fresh designer reviews the look).
- Governing: [storybook plan](../briefs/polish/storybook-plan-2026-10-08.md) C, D, E1, E5; [design input batch 4](../briefs/polish/design-input-batch-4-2026-10-09.md); [book-ui.md Take from a corpse](../system/book-ui.md) (line 277); [owner decision, designer writes batch 5](../decisions/owner-decision-designer-writes-batch5-style-2026-10-09.md); [preproduction gate](../decisions/owner-decision-preproduction-gate-2026-10-08.md).
- Scope: `mobile/app` UI, stories, Storybook config, test harness, docs, `book-e2e.yml`. No save, protocol or kernel file changes, so no hosted CI is required.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. The harness changes are test-only. Existing tests are not weakened, and kernel and save behaviour do not change.
2. E5 regenerates the views and checkpoints and fails on a diff. It runs where claimed. The E1 list is empty except Tap.
3. Each Vite rewrite throws on a mismatch. `storybook:live` fails when a play fails. It runs nightly.
4. Batch 5 uses tokens and colour roles only, with no raw values. Behaviour and press targets do not change.
5. Take from a corpse returns to the corpse detail (book-ui.md:277).

## Proof

- (1) `book()` now takes an optional `newId`, which defaults to `randomUUID`, so existing callers are unchanged. The clock was already fixed at `{wall: 10000}`. The `owners[]` slot reset copies React's rule that a different component type at a slot gets fresh state, so it can only cause failures, not hide them. Mutant: revert to `if (!(i in state))`. Result: E5 fails (`route npc-refused: step 11`) and the other harness tests stay green.
- (2) `stories.test.ts` matches the `*.test.ts` glob in `npm test`, which `bin/check_all.sh:51` runs. Red control rerun with unseeded ids (`seeded` returns `randomUUID`): fails with `views/npc-choice.json is stale`. `npm run stories:views` at head: no diff. `catalogue.test.ts:12`: `EXEMPT` holds only Tap; the `MapDrawing.tsx` file exemption stays, as the brief allows. Planted `export function Zed` in `book/lines.tsx`: `catalogue.test.ts` fails and names `lines.tsx: Zed`.
- (3) Mutant M3: corpse play expects `deer hidee` → `storybook:live` exits 1: `FAIL live--corpse-contents play: Unable to find…`. The other 8 stories pass. Mutant M4: the worker regex is changed to `./workerX`.
  - Warm dep cache: all 9 pass. A warm dep cache skips the optimizer, so the rewrite never runs.
  - Cold cache: exits 1 with `expo-sqlite-worker: …SQLiteModule.ts no longer contains …`.
  - A real expo-sqlite upgrade changes the lockfile, which invalidates the dep cache, so the guard holds.
  - `book-e2e.yml:37` runs `storybook:live` after the smoke, on the nightly schedule.
- (4) The new value is `size.focus` (tokens.ts) and the colours are roles (`dim`/`fg`/`danger`). No `onPress` or label changed. The added `aria-hidden` arrows and here dot keep each name (accessibilityLabel unchanged). Paragraph split mutant (split on a single `\n`): `polish_style.test.ts` fails.
- (5) PR claim rerun. Mutant `resultPages` `slice(0, index + 2)` (keeps the item page): `book/polish.test.ts:11` fails. The Book already does what the spec says; the batch 4 "bug" was a misread play.
- `/code-review medium` is reported for the merge commits.

## Findings

1. nit, `mobile/app/stories/Live.stories.tsx:2`: the comment cites `stories/live/checkpoints.ts`, which does not exist. The checkpoints come from `stories/routes.ts` via `scenarios.ts`. A reader following the cite finds nothing.
2. nit, `mobile/app/.storybook/preview.tsx:63` with `mobile/app/SaveError.tsx:19`: the decorator is the parent, so its effect runs last and overrides SaveError's light-paper ring. In `RecoveryPages` under the night or dusk global, the ring takes the night `action` colour on light paper. This is the same class as the Live fix. Story-only; the app is unaffected.
3. nit, PR body: it reports `/code-review` only for the merge commits. The batch 4 and batch 5 developers' results are not listed.

## Open items (accepted in the PR)

Unscoped `shimMissingExports`; it is dev pre-bundle only, so imports from app code are not shimmed. E5 adds about 10 s. Same-type remounts keep their state (the `ponytail:` note in polish-book.test.ts).
