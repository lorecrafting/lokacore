# Review: polish batch 1 + toolbox foundation (PR #325)

- PR #325, branch `polish/ch1-batch1`, head `18f51b0b`, base main `3cb71825`. Full correctness review; UI design reviewed separately.
- Governing: [Page turn](../BOOK-UI-COMPONENTS.md#page-turn), [Design tokens](../BOOK-UI-COMPONENTS.md#design-tokens), [book-ui](../system/book-ui.md), [owner decision mechanics toolbox](../decisions/owner-decision-mechanics-toolbox-2026-10-08.md) (dev clock and unpinned preview never in release), Beads loka-78r, loka-soq, loka-d04, loka-va9, loka-vqk notes. Record kept: this batch is the polish batch, not a toolbox slice.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Web sync SQLite: bounded allocations; a timed-out call's late reply never answers a later call; results over 1 MB still arrive; the patch is idempotent.
2. A5: recovery `budget_exceeded`/`precondition_failed` fault (no receipt); A6: `already_paid` before `unaffordable`, and GameView shares the order.
3. A release, test or e2e bundle never plays the dev artifact or shows the dev clock; a failed compile keeps the last good artifact.
4. Leaving page takes no touch, keyboard or screen-reader focus; a snapshot later than motion.quick just changes the page; a polarity flip cuts, a same-polarity change fades.

## Proof

- (1) Patch applied twice to a copy: byte-identical. Mutants on `patch-sqlite-web.cjs` (pristine `WorkerChannel.ts` from `npm pack expo-sqlite@57.0.3`): no `syncBuffers.delete` → late-reply test red (`'late reply'`); no `grow` → large-result test red (`offset is out of bounds`); no `syncBuffers.set` → `steady_play.e2e.ts` red (`60820 <= 2`); unmutated it is green (PR claim rerun).
- (2) Reverted A6 → `dream.test.ts` red; A5 `precondition_failed` dropped → `water.test.ts` red; A3 `+ 1` dropped → `c6_source_acceptance`, `e1_night_marsh` red. GameView reads the same `transition` (`view/services.ts:11` → `service/shared.ts:23`). Seed 310 reaches `cooldown` (311 does not), via `sim_batch.fresh`.
- (3) Expo CLI `exportApp.js:131` sets `NODE_ENV=production` before Metro loads the config. `LOKA_DEV_CARTRIDGE=… expo export --platform web` exits 1 with the metro.config.js refusal; plain export bundles contain `loka-ashmere-missing-child.db` and none of `Advance game minutes`, `loka-dev-`, the App.tsx refusal (dead code removed). Backstop `App.tsx:43` throws for a `__DEV__`-false bundle. `author.ts` writing before the kernel check → `author.test.ts` red; metro.config.js production throw removed → `metro.test.ts` red.
- (4) `inert` removed from `over` → `page_turn.e2e.ts` reduced-motion test red (`reachable: true`). Polarity check removed (two forms) → two `palette.test.ts` tests red.
- Scripts: `docs_red_controls.sh` green incl. the new `clean_git_env.sh` plant.

## Findings

1. **nit** `kernel/ts/src/mechanics/expedition/shared.ts:75`: `findIndex` takes the first route edge into `shelter_room`, but the loader pins only `route[2]` (`content/cartridge_expedition.ts:71`, `lib/loka/content/expedition.ex:115`). A route start→shelter→x→shelter loads and offers shelter at cursor 1, where the old literal used 3. Fix: `const shelter = 3; // route[2].to, pinned by the loader` or reject `shelter_room` at `route[0..1]` in both loaders.
2. **question** `mobile/app/App.web.tsx:12`: the whole web app now waits on CanvasKit; a wasm load failure (e.g. Safari Lockdown Mode, which disables WebAssembly) leaves a blank page with no SaveError. Intended, or should the Book fall back to an uncurled turn?
3. **nit** `mobile/app/sqlite-web-worker.test.ts`: no unit test catches dropping the buffer cache; only the 5-minute `steady_play.e2e.ts` does. Acceptable as is.

## Fix round 1 (head `aac1b9f9`)

Scoped to the fix commits and their direct callers.

- R1 `760e915f`: `shelter = 3` matches the `route[2].to` pin in both loaders (`content/cartridge_expedition.ts:71`, `expedition.ex:115`). The new `c6_expedition.test.ts` test fails when `findIndex` is put back (2 pass, 1 fail). Its world sets `route[0].to = shelter_room`. That world would fail the loader's chain check (`cartridge_expedition.ts:56-60`, `route[1].from` is no longer `route[0].to`), so the test exercises `refused` directly. That is enough, because the cursor rule does not depend on the chain. Resolved.
- R2 `58b45ddf`, `aac1b9f9`: `page_turn.e2e.ts` passes 4 of 4. Removing the `.catch` in `App.web.tsx` makes the no-CanvasKit test fail. Building the shader at module load (eager `Skia.RuntimeEffect.Make`) also makes it fail (blank page, 60 s timeout). Callers: `snapshot.web.ts` rejects with no CanvasKit, and `warm` and `PageTurn` both handle that rejection. `Curl` mounts only once a picture exists. Resolved.
- D1 `ece000ab`: the bleeding line uses `c.danger`, which the palette contrast test covers. D2 `46b6576a`: `detail` never returns raw text; `presenter.test.ts` passes 12 of 12. Its only caller is `SaveError.tsx:19`. Resolved.
- F1 `ebc20054`, `d9091784`: the test still covers kill, hide, Take, then reload. With seed stream 1 it passes 2 of 2. With stream 16 it fails, and its failure screen shows "The deer bounds south." That confirms the explanation that the deer flees at the deadline. Two misses at 25% each give 6.25%, which agrees with the observed 21 of 400. The first deer test keeps a drawn seed. Resolved.
- Nits `bf9ffca6`: `space.page` = 24 and `size.touch` = 44, the same values as before; the imports are present.

Fix round 1: **APPROVE**.
