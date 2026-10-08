# Review: Skia page-curl spike (PR #308)

- PR #308, branch `spike/skia-page-curl`, head `cd9487b9`, base main `38da1f46`. Hosted `ci` and `book-e2e` green on that head (`page_turn.e2e.ts` 2 tests ran).
- Governing: [Page turn](../BOOK-UI-COMPONENTS.md#page-turn); [owner decision 2026-10-07](../decisions/owner-decision-design-foundation-2026-10-07.md) (Skia, Reanimated, mobile-compatible); [book-ui](../system/book-ui.md). Stance: spike, proportionate; device work paused.
- Settled before this review (not findings): designer should-fixes filed as Beads loka-78r; owner-accepted `mobile-renderer-imports` widening.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. `page-curl.sksl` stays the one curl source for web and device; no CSS or WebGL second curl.
2. The arriving page takes input from the first frame; nothing over it takes touches.
3. Reduced motion: cross-fade over `motion.fade`, no curl. New turn replaces a running one.
4. Not wired into the live Book; the live web app loads no CanvasKit/wasm.
5. New dependencies exact-pinned, `canvaskit-wasm` equal to Skia's own dependency; lockfile adds only their tree.

## Proof

- (4) Throwaway e2e probe, `performance.getEntriesByType('resource')`: `/` loads only `index.ts.bundle` and the two fonts; `/?preview=page-turn` adds the `LoadSkiaWeb` and `page-turn-preview` chunks and `canvaskit.wasm`. `PageTurn`/`snapshot`/Skia imported only by `App.web.tsx` (lazy), `page-turn-preview.tsx` and `book/`. Dev server only; production `expo export` splitting not checked.
- (5) `package.json`: skia `2.6.2`, reanimated `4.5.1`, worklets `0.10.1`, canvaskit-wasm `0.41.0`; lockfile skia entry requires `canvaskit-wasm: 0.41.0`. Lockfile diff is additions only (the new packages, their babel/RN metro transitive deps, skia native binaries `147.1.0`); no version of an existing entry changed.
- `docs/CHECKS.md` merge resolution: `git diff 38da1f46 HEAD` equals the three-dot diff (15 files); CHECKS.md keeps main's text plus the one Skia/Reanimated/Worklets clause.
- Test the tests (throwaway worktree, restored): M1 `pointerEvents` removed from `over`: both tests red (`hit:false`). M2 leaving page = `p.children` instead of `lastPage.current`: both red (`curl:false`; `stayed 0`). M3 `direction: 1`: **green** (finding 3).
- (3) Six turns, each interrupted five frames into a curl: no console error, unhandled rejection or leftover canvas on web; final page correct.
- `snapshot.web.ts`: failed font fetch is evicted (`:33`), CSS sits in CDATA (`]]>` cannot occur in rules or base64), a cross-origin sheet makes `cssRules` throw, the snapshot rejects and the page simply changes (`PageTurn.tsx:108`); no `$` patterns in `replace` data. SVG-as-image runs no script.

## Findings

1. **should-fix** `mobile/app/tests/page_turn.e2e.ts:70`: `stayed >= 150` against a 160 ms fade; 24 local runs measured 166.7 to 200 ms, so the margin is one 60 fps frame. Reanimated starts the fade at assignment time, so one stalled frame after the commit (loaded CI runner) shortens `stayed` below 150 and fails the job. Fix: a bound such as `>= 80`; the "vanishes at once" control (`ReduceMotion.System`, about 0 to 33 ms) stays red.
2. **should-fix** (carry to loka-78r wiring) `mobile/app/book/PageTurn.tsx:78-82,106` with `snapshot.web.ts:22-39`: the leaving page is shown, touch-transparent, over the live arriving page for as long as the snapshot takes (first web turn about 2.6 s by the PR's own measure). A tap in that window lands on a control of the page the reader cannot see. Fix in the wiring slice: bound the hold (drop `leaving` after a short timeout) or warm the font cache before the first turn.
3. **nit** `mobile/app/tests/page_turn.e2e.ts:39`: "both ways" checks only that a curl draws; M3 (direction ignored) stays green. Pin direction (a pixel sample on one side mid-curl) when wiring.
4. **nit** `mobile/app/book/PageTurn.tsx:113,148`: `reduced` in the effect deps; toggling reduced motion during a curl runs the cleanup that disposes `leaving.image` while `Curl` still draws it, then re-animates the disposed image. Rare; key the dispose to `leaving` only.
5. **note** (device only) dispose vs UI-thread frame: no defect on web (proof above); verify on device when mobile resumes.

Over-engineering: none found; `sksl-transformer.cjs` is the smallest way to share one shader file.
