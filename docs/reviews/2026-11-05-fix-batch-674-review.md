# Review: fix batch (loka-kgd.219, loka-wfrgk.55, loka-wfrgk.44, loka-wfrgk.49)

- PR: #674 `fix/batch-2026-11-05`
- Reviewed commit: `fa6c6e6020dcf8577ce733791d6085c433d6d9a4` (base main `f74802703`)
- Governing: [mechanics.md D6 water](../system/mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-contract),
  [cartridge.md author preview](../system/cartridge.md#author-preview) (Keep my place, Checkpoints),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached worktree `pr674-review`
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED** (one logic should-fix, so a fix round)

## Must be true (written before the diff)

1. A water cartridge whose `hp` can never reach 0 is refused at load with a water diagnostic; no shipped cartridge trips it; D6 states it.
2. One panel advance is bounded by what drives its cost, the same on record and on restore; `bin/loka check` and the panel replay a recording alike (cartridge.md "Keep my place").
3. A tall Inspector card scrolls inside itself; the page does not scroll.
4. A fresh `bin/worktree_setup.sh` installs every tracked lockfile, `tools/author-panel` included.

## Checks that held

- kgd.219: only `cartridges/water_sampler` declares routes; its `hp` minimum is 0 since `a9be05ccd` (#665) and it
  compiles clean. `SCHEMA_VIOLATION`/`invalid_value` at `cartridge.world.water` matches the sibling water refusals.
  Drowning reads the literal `hp` (`kernel/ts/src/mechanics/water/expiry.ts:21`). mechanics.md D6 amended;
  cartridge.md has no `world.water` validation text, so it needed none.
- wfrgk.49: a fresh setup at the head installed `tools/author-panel/node_modules` with its marker (19 s, `npm ci`).
  `worktree_setup_red_controls.sh` passes; with main's loop it fails "nested lockfile not installed".
- wfrgk.44: real Chrome, 1280×900, tollhouse: page 900/900, card 5617 px in 729 px scrolls 4888 px, console 128 px.
- Kernel: untouched; `replay`'s fourth parameter is optional, the check's behaviour is as before.

## Mutants

`bin/mutate_diff.sh origin/main`: 6 mutants, 4 run, exit 0. place.ts:49/50/271/272 red-narrow; water.ex:32 ×2
NO-TESTS. Hand (`bin/mutate.sh`), all red-narrow on green baselines: `min > 0`→`min > 1` and `["hp"]`→`["mv"]`
(content_water_test.exs); check.ts dropping `Infinity` (check.test.ts). The last two rerun PR-body claims.

## Findings

- **Should-fix** `mobile/app/author/place.ts:40,49,271` with `panel.tsx:150`: the budget is real ms, but cost
  follows game time (the body: "grows with ms × rate"). `furnish_sampler` (rate 1) now refuses 61 game minutes
  (3,660,000 ms), which cost nearly nothing and were allowed before; a rate-2400 cartridge (schema allows up to 2^53)
  may advance 2400 game hours at once, more than the 60600 minutes (1010 h) that crashed the tab. Set the budget in game
  time and pass `budget/rate` from both panel callers (`canon()` is in scope at `panel.tsx:97,150`).
- **Should-fix** `docs/system/cartridge.md:904,921-924`: "replays alike in both" / "through the same replay" no
  longer holds. A checkpoint `{"advance": 4000000}` passes `bin/loka check` in CI, but jumping to it in the panel
  refuses step 1. State the budget and the check's exemption.
- Nit `place.ts:50`: the author typed minutes, but the refusal is given in ms.
- Nit `bin/lib/serve.sh:31`: main never installs `tools/author-panel`, so every new worktree runs a full `npm ci` there (open in the body).
