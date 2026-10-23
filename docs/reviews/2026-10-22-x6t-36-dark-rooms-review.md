# Review: dark rooms, LegendMUD style (loka-x6t.36, PR #449)

- Branch `feat/x6t-36-dark-rooms`, exact commit `fad95e29268d1da40e6dcd48f40c86b4db161625`.
- Governing: [B4 light and darkness](../system/mechanics.md), [B6 glow exception](../system/mechanics.md), [protocol.md](../system/protocol.md), [book-ui.md](../system/book-ui.md), [Review stance](../WORKFLOW.md#review-stance), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent); owner decision 2026-10-22 (paraphrased): an unlit player in a dark room reads "It's too dark to see..." and sees no items, NPCs or players; a room is dark by the flag or an authored dark_description; blind is dark anywhere; authored text wins; exits work; light restores sight.
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **CHANGES REQUIRED** (one blocker; hosted `elixir` job red on this head).

## Must be true (written before reading the diff)

1. Unlit in a dark room, the view carries only the dark text, known exits, inventory, posture and escape controls: no description, asides, items, NPCs, players, targets or adjacent-sight contents (B4).
2. An authored `dark_description` wins over `place.dark`; a blind actor reads dark anywhere; light restores the plain view.
3. Both kernels gate `dark: true` the same way: light@1 required, kernel_api floor 1.114, and invalid content yields diagnostics, not a crash.
4. Save impact none: no cartridge, conformance or frozen fixture changes; existing content hashes unchanged.
5. Default words are exactly the owner's: `It's too dark to see...`.

## Findings

1. **Blocker**, `lib/loka/content/requires.ex:45` (fed by `checks.ex:295`). `rooms` is `Map.values(defs["room"])` unfiltered, so a schema-invalid room file is the atom `:invalid` and the `fn {_, _, d}` clause raises `FunctionClauseError`. Scenario: any cartridge with one malformed room crashes the compiler instead of returning diagnostics. Hosted run 39894867029 `elixir` fails `content_rooms_test.exs:145`; reproduced locally (`mix test test/loka/content_rooms_test.exs:145`, 0/1). Fix: filter like `all` does (`{_, _, _} = d` only) in `checks.ex:295` or in `light_minimum`; that existing test is the regression pin.
2. **Nit**, PR body: no 390 px Book screenshot of the World page while unlit, so item 8 (Book wording against book-ui.md) is judged from words.ts/text.ts only.
3. **Nit**, `requires.ex:45` tests `is_map_key(d,"dark")`, TS `cartridge_fuel.ts` tests truthiness. They differ only on `dark:false`, which `room.schema.json:488` (`const: true`) rejects first; no live divergence.

Questions / pre-existing (not raised against this slice): the perception-NPC branch in `light/shared.ts` `visible()` is identical on main and is the B6 wisp exception; entry engagement (`disposition.ts:136`) and the combat view name a foe in the dark, as already for dark_description rooms ("existing combat restrictions still win").

## Checks run

- **1-2.** Key-level probe: the unlit GameView JSON (2798 chars) of the new light test holds no `peg` or `oil` substring at all, not only no ids. `describe`/`asides` callers: `view.ts:128,135` (gated), `view.ts:184` and `notice_boards.ts` (entities/details filtered by `visible`), `text.ts:210` (details after resolve). PR claim "placeView is the only room caller" holds; cite `target.ts:84` (`present()` checks `visible`) holds.
- **3.** TS light, light_contracts, loader_floors tests pass; Elixir content_light, loader_floors, cartridge_cross_kernel 12/12 pass; but finding 1.
- **4.** `git diff --stat origin/main...HEAD -- cartridges docs/spec/conformance test/fixtures kernel/ts/test/fixtures mobile/authority` is empty; `invalid.json` adds one case only; `loader_floors.json:33` adds one 1.114 case mid-file; the test has no ordering assertion. Cross-kernel hash tests pass on unchanged fixtures, so existing saves reopen byte-identical.
- **5.** Exact match in `mobile/app/book/words.ts:17` and `kernel/ts/play/text.ts`.
- **Mutants** (bin/mutate.sh, all red, tree clean after): view.ts asides ungated; cartridge_fuel.ts floor order swapped (19 before 114); text.ts single dot.
- **Merge with #447:** `bin/merge_resolve.py` already keeps the higher `kernel_api` at `world.ts:108`; take 1.114 and regenerate `contracts.gen.ts` and the system graph. #447's 1.111-1.113 floors stay below it.
- `/code-review medium` reported (7 findings). CI on head: kernel, mobile, lint, e2e, storybook, walk, graph-diff, book-e2e pass; `elixir` and `ci-green` fail.
