# E2 S1 synthetic R9C interaction cartridge review

- PR [#309](https://github.com/lorecrafting/lokacore/pull/309), branch `e2/s1-synthetic-cartridge`.
- Reviewed: `6eb5b647f569457f1b5494f3df608c5d17aa414f`. Slice diff is `origin/main...6eb5b647` (commits `d7d3decd`, `ddebc4e3`, then a merge of main `38da1f46`).
- Governing: [E2 brief](../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md) (scope :34, families :57-70, acceptance 1 :101); [cartridge.md](../system/cartridge.md) Development cartridges, Artifact and loader; [mechanics.md](../system/mechanics.md) B8, B9, C3–C5, D1, D7, D8, D12 (unchanged).
- Verdict: **APPROVE**

## Requirements written before the diff

1. The compiler and the TS loader both admit the artifact. Its hash and initial IDs equal answers from a stdlib Python oracle, not from the compiler.
2. Malformed and uninstalled-capability variants refuse in the loader, before any world exists.
3. No historical or production fixture is edited or retargeted. The cartridge stays out of the simulator's default `cartridge_*hash.json` glob.
4. No mechanic code changes.
5. Every family row (brief :57-70) is reachable from the start state with installed forms.

## Checks

- Requirement 4: outside `cartridges/r9c_interactions/`, the diff touches only `docs/system/cartridge.md`, two new tests, two new fixtures and the oracle. Nothing in `lib/` or `kernel/ts/src` changes. All fixture changes are additions. `missing_child_v042_hash.json` is read and its sha is asserted (oracle :14). The names `r9c_interactions_*` miss the `sim.ts:73` glob. There is no `transcripts/` directory, so `transcripts.test.ts` and `features.exs` do not pick the cartridge up.
- Oracle: uses only stdlib (`hashlib`, `json`, `uuid`). Its edits to the reviewed v042 answer are literal. It copies only the text catalog, which follows the existing convention (`cartridge_chapters_hash.py:35`, `..._v016_hash.py:60`). Re-running it at head reproduced `7d74fac7…` (26 rooms, 127 IDs) and left `git status` clean.
- Baseline: the ExUnit test passed 1/1. `node --test test/r9c_interactions.test.ts` passed 2/2.
- Red controls in this worktree, each restored afterwards:
  - M1: `services/lantern_room.json` price 4 to 3 made ExUnit exit 2.
  - M2: `fresh.ts` allocating `consumed` before the slot holders failed the ID test (exit 1).
  - M3: `cartridge_installed.ts` skipping the installed check failed the refusal test (exit 1).
  - The TS test reads the pinned canonical bytes, not source. Source drift is caught by ExUnit, and the loader/allocation drift by TS. This is the existing two-kernel pin chain.
- Refusal before mutation: `loadCartridge` is the only path to `newWorld`. Both variants assert the exact code and path (`r9c_interactions.test.ts:54-68`).

## Family reachability (start: Ferry Landing, 20 pennies)

| Family | Route and entities |
|---|---|
| Identity, custody, trade | Three apples on the Green and 12 fenwort at Willow Shade (matching nouns). Peg in the Chandler sells satchel/torch/waterskin, with the Haggle discount (`buy_discount`). Haggle qualification (dex ≥10, mv ≥5) can be lost through mv. The Chapel door is open at start and can be closed for Knock. Vesper's message is in Fox Hollow. |
| Terminal fork | Fox Hollow via Reed Bank and Mire Crossing (Wren, Vesper). Belfry via North Gate, Chapel Steps, Nave and Bell Tower. Five epilogue recipes on the Green. Elspeth at Ferry Landing. |
| Rest, dream, liquid, light | Maud: room 4, meal 2, ale 1 (from 20). Inn Rooms bed with `lantern_bed_paid`. Well `liquid_source` in Well Lane. The torch's `fuel.supply` is `lamp_oil`. Dark rooms: `well_shaft`, `well_bottom`. |
| Hound, bleed, escort, expedition | `fen_hounds` (Hound Run/Adder Nest): 80% hit for 1 damage, then `bleeding`. Wick and 12 bandages are in Chapel Nave, which is also the shrine. Wren escorts to Elspeth. The expedition route and footprint use only kept rooms. Combat (`round_attack.ts`) is the RNG draw; `check@1` is dropped, and its only v042 user was `seek_wisp`. |
| Patrol and deer | Tobin at Watch Post. The `watch_rounds` route and checkpoints are all kept rooms. `oak_deer` and `willow_deer` populations. |
| Crow provenance | `old_coin` at Well Bottom. Its corridor runs Green, Well Lane, Ferry Landing, Reed Path, Reed Bank, Willow Shade, Drowned Oak, Oak Branches; every leg is an existing exit. `crow_nest` has the `crow_nest_lid` barrier. |
| Skill, water, terminal consumption | Outbound ferry at Boathouse (5) and free return. Sedge teaches Swim and Herbalism. Well water route with `maximum_grams` 6000 (load). Careful Harvest at Willow Shade. Wick's exchange. Apples to Eat. |

Owned-corpse recovery (D1 fare waiver) can only happen in `fen_isle_landing`, which has no exits and no hostiles. It is reachable this way:

1. Let a hound wound the player to 2 HP or less while bleeding.
2. Flee.
3. Walk four rooms to the Boathouse and board. `transport/shared.ts:55-60` requires the body to be alive, standing and not engaged. It does not check bleeding.
4. The bleed ticks at +100 s and +200 s (1 HP each), so the player dies on the isle.

This is narrow but legal. **Note for S4:** it is the only route to that row.

## Findings

None at blocker, should-fix or nit.

Ruling on the deferred allocation-label duplication (`r9c_interactions.test.ts:29-48`, which copies `missing_child.test.ts:29-48`): **acceptable**. There are two sites, and each is compared against its own independent oracle, so drift in either one fails loudly. Extract a helper if S2–S4 add a third copy.
