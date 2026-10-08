# Review: E2 S2 families 1-2 custody, trade, terminal fork (PR #314)

- PR #314, branch `e2/s2-custody-terminal`, head `0490d150`, base main `c44a44c3`. Hosted CI green. Test-only: two new files, nothing else changed (`git diff --stat c44a44c3`).
- Governing: [slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md) S2, exit criteria 2 and 5, rules for every slice; [E2 brief](../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md) rows 64-65; protocol.md target resolution, ActionSet admission, B3/B5/D10/D12 compositions; save.md commit/fence/reconcile, story points, Green finale recovery.
- PM-accepted deviations (not findings): no nave-side view after closing from the steps (`barriers.test.ts:189`); step 8 not added (`light.test.ts:117`, `training.test.ts:424`); authority uses `sqliteHost` + `openStory`.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (derived before the diff)

1. Literals come from content or ids.json: apple candidates in code-point order; pennies 20/18/14, Peg 20/22/26; quote 4, stale 5 refused; capacity 4; Wick moves the three lowest held fenwort and Wick's three lowest bandages; axis -1; `knock.chapel.answered` with no ops; Where answers `chandler`; per-fork bell and epilogue facts.
2. Every player command leaves `state.rng` unchanged; every refusal changes nothing.
3. Authority: close and reopen through the real loader after every committed intermediate; forks start from one byte-identical file.
4. Report count 0 on every line, 1 after the final Continue; replay returns receipts with no row change; the other terminal refuses.
5. A genuinely failed final COMMIT adopts nothing, reopens at line 3, and the retry applies once.
6. No content, fixture or source edit; no shared helper; no E1 import.

## Proof

- (1) Wick IDs checked by hand against ids.json: fenwort_04 `2d52` < 02 `aecc` < 03 `bb12` < 01 `d56f`; bandage_10 `192a` < 01 `1d97` < 09 `2de1`. Apples 03 `35b6` < 01 `4ab9` < 02 `c502`. `at: 64800` is `cartridge.json` calendar start.
- (2) kernel `r9c_custody_terminal.test.ts:63-64`; authority `:87-89`. (3) authority `:72-77,90,284`. (4) `:307-310,331,335-343`. (5) `:316-326`. (6) diff stat.
- The consumed-line Continue code `unsupported_capability` (authority `:338`) is the spec code for an action absent from the ActionSet (`invocation.ts:105`), not a kernel-run copy.

## Test the tests (throwaway worktree, restored, `git status` clean)

| Mutant | New files | Existing |
|---|---|---|
| M1 adopt before COMMIT (`save.ts`, assign `s.world` before `commit`) | authority red at `:323` | `faults.test.ts` (seeds), `bell_receipts.test.ts` Ring/Silence red; `story_points.test.ts:283` green |
| M3 scene `on_end` applied at line 1 (`scene/rule.ts:30`) | kernel red `:288`; authority red (reopen `:308`) | `missing_child_finale.test.ts`, `finale.test.ts` red |
| M2 `fact_compare` true for `chapel_allegiance` (`policy.ts:39`) | both green (r9c also gates on `bell_of_ashmere` active and `chapel_bell_rung`) | `missing_child_bell.test.ts:136` red; the PR's wider mutant (policy recheck skipped) turns the new files red |
| M4 receipt lookup skipped for `continue` (`invocation.ts:57`) | authority red `:81` (replay) | **no other test red**: full mobile run, plus the 7 Mix-dependent files rerun with Elixir deps (40/40 green) |
| M5 exchange selects highest IDs (`stock.ts:18`) | both red | many kernel and authority tests red (`reward_storage` itself green) |

`story_points.test.ts:283` staying green under M1 does not matter: it guards report and gameplay in one transaction (storage), not memory adoption, which `faults.test.ts:207`, `bell_receipts.test.ts` and the new `:323` kill.

## Findings

- Assertion surface: action keys, GameView fields (`scene`, `exits`, `skills`, `journal`, `notices`, `resources`, `shop`) and text keys; committed state (`containers`, `resources`, facts, `rng`, `report` rows) is the literal-state comparison the brief requires. No rendered copy or style.

1. **nit** `mobile/authority/local-story/r9c_custody_terminal.test.ts:1-5,233-236` and PR body ("claims no new detection"): M4 (an exact Continue replay re-decided instead of returning its receipt) is red only in this file. Scenario: a later cleanup trusts the "killed elsewhere" header, deletes this file as duplicate coverage, and a re-decided Continue replay loses its only guard. Fix: name the Continue replay break in the `// Breaks:` header.
2. **nit** `kernel/ts/test/r9c_custody_terminal.test.ts:107`, authority `:139-141`: "Wick binding other IDs" cites `reward_storage.test.ts:68/:100`, which stays green under M5. The actual kills are `bound turn-in refuses stale exact custody…`, `finite harvest selects the lowest real ID at equality…` and `four immediate explicit exchanges conserve…`. Scenario: a reader removes the cited test's neighbours believing reward_storage guards selection order.

Over-engineering: none; setup is inline, reuses `sqliteHost`/`openStory`, no helper file.
