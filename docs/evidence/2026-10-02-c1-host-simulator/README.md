# c1-host: Release iOS Simulator rows, 2026-10-02

Result: **all 5 device rows pass**. Spec: ADR-075 §3 (seed, kernel version) and §4 A4
(`world_context_id`), 10 §§31-32, [save.md](../../system/save.md). Brief: c1-host (PR #129).
Facts are labeled **device-reported** (read from the save the app wrote, copied off after
`xcrun simctl terminate`) or **inspected**. UDID and paths are withheld.

## Build facts (inspected)

- Clean build: `063f6f36c14de0bd87e708f8e5409e8c8dd4af81`, the PR head at build time (later
  commits are evidence only). `git status --porcelain` was empty before `npx expo prebuild
  --platform ios --no-install`, after it, and after `pod install`. Release, `iphonesimulator`,
  Xcode 27.0, iOS 27.0 Simulator (a new device for this run).
- Old build: `f8564cb` (origin/main before this PR), same recipe, in a detached worktree.
- Luck harness build: the clean tree plus [dev-App.tsx.txt](dev-App.tsx.txt) as `App.tsx`
  (Q2: evidence only, never committed; restored after the build). Its stamp is `-dirty`.
- Bundles: [bundles.txt](bundles.txt) (the stamp in each `main.jsbundle`; the local exports).

## Rows ([saves.txt](saves.txt), [luck.txt](luck.txt))

| Row | Result | Proof (device-reported unless noted) |
|---|---|---|
| Old save upgrade | **pass** | f8564cb, one step (accept Bram's quest): revision 2, seed `[1,2,3,4]`, pin without `world_context_id`, header `loka-kernel@000…0-dirty`. The head installed over it: same revision 2, same room and narration ([upgrade-reopened.png](upgrade-reopened.png), inspected); pin still without `world_context_id`; a new segment header `loka-kernel@063f6f3…` (no `-dirty`) under the template context. |
| Load | **pass** | Fresh install: revision 0, seed `[1589861743,…]` ≠ `[1,2,3,4]`, pin `62ce1802-9055-40cd-…` (v4 UUID), header `loka-kernel@063f6f36c14de0bd87e708f8e5409e8c8dd4af81` with that context. Start over (Settings, confirmed): seed `[1501714025,…]`, context `9ec73fe7-…`, a new run's header under it. |
| Kill | **pass** | Two steps (quest, north), `simctl terminate`, relaunch: revision 3, 3 receipts before and after; Village Green with the quest line ([kill-relaunched.png](kill-relaunched.png), inspected). |
| Luck replay | **pass** | Dirty dusk harness: launch 1 `pick_lock` `replay=false`, rng `[3041623178,…]` → `[3865147115,…]`. Killed, relaunched: the same invocation `replay=true`, rng unchanged, decision bytes equal (803 bytes, the same SHA3-256). Header `loka-kernel@063f6f3…-dirty`; seed and context drawn (not the template). |
| Damaged save | **pass** | S6a recipe (byte 0 of `state_row`'s root page set to `0xff`, app terminated): SaveError "The save is damaged…" `(save_corrupt)` with Start over ([damaged-save.png](damaged-save.png), inspected). Start over confirmed: a working game (moved north, revision 1), new seed `[2310738935,…]` and context `a16d1f22-…`, `integrity_check` ok. |

Kernel version (acceptance 5): the clean build's header reports the bare `@063f6f3…`; the dirty
build's `-dirty`; the local export with an untracked file has `<HEAD>-dirty` ([bundles.txt](bundles.txt)).
Kept failing result: before the Metro cache key, a local export with an untracked file kept the
clean stamp from the cache.
