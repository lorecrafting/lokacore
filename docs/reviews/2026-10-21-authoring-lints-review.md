# Review: authoring checks A, cartridge lints (loka-kgd.180)

- Local branch `checks/pass1-lints`, exact head `4cf222db9bffb3510c6c9bf9f3e3cd2082c8a1aa`; base `checks/pass1` (`b1ae4806`); no PR. The claim reruns used the Beads handback (`br show loka-kgd.180`).
- Governing: [pass-1 analysis, candidate checks rows 1, 2, 3, 3b, 5, 6](../playtests/2026-10-21-pass1/analysis.md#candidate-deterministic-checks) and the triage rows M1, T1, T4, C2a, T5, UH, UK, W1; [mechanics.md reactions](../system/mechanics.md) (the `silent` line, status refresh `:666-669`, `status.cure` "no event, no line" `:2510`); [cartridge.md](../system/cartridge.md) kernel_api floors for new optional fields (`:1784-1792`); [contracts lessons](../lessons/contracts.md); AGENTS.md "Writing tests". PM ruling (a): author-time lint only, no loader or loader_floors change. Owner 2026-10-21: lint is required only for toolbox_showcase.
- Written 2026-10-21 by anthropic/claude-opus-5-5.

**Verdict: CHANGES REQUIRED** (three should-fix, no blocker).

## Must be true (written before the diff)

1. No kernel loader, loader_floors or protocol change except the optional `silent`.
2. Each check implements its row: 1 (M1), 2 (R1, R2), 3 (T1, T4), 3b (C2a), 5 (T5, UH), 6 (UK, W1). Each has a literal-message test and a red control.
3. `silent` is in the schema and the mechanics.md reactions text, and both kernels accept it.
4. The baseline is a two-way ratchet.
5. The Book reason words read correctly in "You can't do that: X." and "The way north is X.".

Holds: 1, 4 and 5. 2 holds in part (findings 2 and 3). 3 holds, but see finding 1.

## Evidence

- Focused runs at the head:
  - `content_lint_test.exs`: 9 passed.
  - `reasons.test.ts` with `presenter.test.ts`: 15 passed.
  - `elixir bin/contracts.exs --check`: exit 0.
- Mutants, all killed:
  - M1: drop the `silent` guard (`lint.ex:35-41`).
  - M2: band `< 100` to `<= 100`.
  - M3: shadow `i < j` to `i != j`.
  - M4: drop the 3b arrest guard.
  - M5: drop the `@always` guard.
  - S1: schema `silent` `const: true` to `type: boolean`.
  - B1: remove one baseline line.
  - B2: add one baseline line.
  - Remove the `budget_exceeded` word.
- `silent` probe:
  - A showcase copy with `"silent": true` on `reactions/attic_drench.json` compiles, and the TS `loadCartridge` loads it.
  - `mix loka.lint` drops that finding: 114 findings left.
  - `"silent": false` gives SCHEMA_VIOLATION const_mismatch at `reactions/attic_drench.silent`.
- Claim reruns:
  - "baseline 115 showcase findings": confirmed; the file has 115 lines and the test passes.
  - "5 new words in words.ts:77": confirmed at `:77-82`.

## Findings

1. **should-fix**: `protocol/reaction.schema.json:507-510`. `silent` is called "Author-time only", but the compiler copies it into the artifact, where the probe found `cartridge.reactions[...].silent`. Every other new optional artifact field has a kernel_api floor (cartridge.md:1784-1792); this one has none.
   - Failure scenario: loka-kgd.184 marks reactions silent. A kernel built before this schema then rejects the showcase with UNKNOWN_FIELD at `.cartridge.reactions.<key>.silent`, not KERNEL_API_RANGE_INVALID: at the base, `ReactionRule` has `additionalProperties: false`, and `kernel/ts/src/content/cartridge.ts:114-119` validates the artifact against it. The mark also changes `cartridge_hash`.
   - Fix: strip `silent` in the compiler, which keeps ruling (a) and the hash; or add a floor, which overturns ruling (a) and needs the PM. COST XS.
2. **should-fix**: `lib/loka/content/lint.ex:10` and `docs/system/mechanics.md:602`. `@writes` misses two ops:
   - `fact.stamp`, which is in row 3's "fact.set" class. water_croft and water_plot escape.
   - `status.cure`, which has no line by spec (`:2510`). wanted_cleared and warmth_dries escape.

   `barrier.set`, `item.move`, `replenish.run`, `quest.*` and `experience.grant` are outside row 3. Fix: add the two ops to the lint and to the mechanics.md list; the baseline grows by 4 lines. COST XS.
3. **should-fix**: `test/loka/content_lint_test.exs:42` labels the test "(C2a)", and `docs/CHECKS.md:105` maps the lint to row 3b. The three C2a NPCs (raider, wight, attic_wight) have `attack` and no `disposition`, so 3b reports nothing on them. Per the entity schema, `engage` speaks only for a hostile disposition.
   - Failure scenario: loka-kgd.184 or pass 2 treats C2a as guarded, but those fights still open with no line.
   - Fix: relabel the test and CHECKS.md so they say C2a is not caught. The C2a fix itself is a content decision. COST XS.
4. **nit**: `lib/loka/content/lint.ex:92-93`. `conds/1` has no clause for a variant without `when.root`, and lint reads raw source, not validated source. A typo'd variant crashes `mix loka.lint` with FunctionClauseError instead of a finding.
5. **nit**: `test/loka/lint_baseline.txt:1` and `content_lint_test.exs:113`. A real new finding passes if its line is added to the baseline in the same commit. Fix: add a `#` header naming loka-kgd.184 (the prefix filter already skips it) and `assert length(known) <= 115`.
6. **nit**: `mobile/app/book/words.ts:77` and `:82`.
   - The comment "Proposed for designer approval" is stale: the five words are approved here (owner rule 2026-10-21), so drop the comment.
   - `budget_exceeded: 'too much at once'` suggests the player asked too much. Optional replacement: `'more than the book can follow'`.
   - The other four words read correctly in both frames.
7. **nit**: the handback reports `/code-review b1ae4806..4a920385`. That range misses `1f6daf9e` and `4cf222db`; run it over `b1ae4806..4cf222db` in the fix round.

## Re-check round 1 (head `32581ff6521c4ff43f41d3b8c558954992353c5a`)

Fix commits `bfc43c1a`, `9a2ee165` and `32581ff6`.

**Verdict: CHANGES REQUIRED** (two should-fix).

Dispositions:
1. Verified. `compiler.ex:331` drops `silent` from ReactionRule only. A source copy with `silent: true` compiles to the same artifact bytes (the new test). Mutant M6, removing the strip line, is killed.
2. Verified. `lint.ex:10` covers both new ops, `mechanics.md:602` is updated, and the four new baseline lines are pinned.
3. **Not resolved (new should-fix R1-A below).**
4. Verified. A variant with no `when` gives a finding. Mutant M8, dropping that finding, is killed.
5. Verified. The baseline header names loka-kgd.184, and the cap of 132 equals the current line count.
6. Verified. The comment is dropped, and `budget_exceeded` reads 'more than the book can follow'.
7. Accepted. The `/code-review` range ends at `bfc43c1a`. This re-check covers the two later commits with mutants M6 and M7.
- `9a2ee165` is correct. `Enum.find(... < 100)` matches `bandOf` (`kernel/ts/src/view/resources.ts:52`), which takes the first cut reached. Mutant M7, restoring `any?`, is killed.

Focused run: `content_lint_test.exs` 10 passed, with mutants M6, M7 and M8 each 9/10. The worktree is clean afterwards.

Findings:
- **R1-A should-fix**: `lib/loka/content/lint.ex:43-50` and the 13 `npcs/*` lines in `test/loka/lint_baseline.txt`. The widened check 3b asks an NPC that has an attack but is not hostile for an engage line, and the loader forbids that line. `Loka.Content.Standing` and `cartridge_standing.ts:44-46` require `engage` exactly when the NPC is hostile and has an attack. Probe: adding `disposition.engage` to `raider` clears the lint finding, and then `mix loka.compile` fails with SCHEMA_VIOLATION `invalid_value` at `npcs/raider.disposition`. loka-kgd.184 can clear these 13 lines only by making hen, gil, boar and the rest hostile, which makes them attack on entry, or by removing their attacks. The original hostile-with-attack shape is already a compiler error, so check 3b catches nothing either way. Fix: delete check 3b and its 13 baseline lines (cap 119), and record C2a as a non-lint row. A player's Attack on an NPC that is not hostile opens with no line, so C2a needs a Book or kernel opening line or a content ruling. COST XS.
- **R1-B should-fix** (deferred item `lint.ex:16`, ruled now): `run/1` ignores the diagnostics from `Source.load`, and `lint` returns `[]` for a missing folder and for the parent `cartridges` folder (probe: `{0, 0}`). Today the baseline equality test catches this. Once loka-kgd.184 empties the baseline, a move or rename of `cartridges/toolbox_showcase` (loka-4hik is in progress) turns the test into `[] == []`, and the CI gate passes with no signal. Fix: `run/1` raises unless `cartridge.json` was loaded. COST XS.
- Deferred and agreed: `:59` blueprint variants (outside the rows), `:36` malformed source (it crashes loudly; it does not pass quietly), and `:10` other ops (outside row 3).

## Re-check round 2 (head d0456a40395cae357b0626f9e3d8fc321d23823f)

Verdict: **APPROVE**. Scope: R1-A and R1-B and the code they touched only.

- R1-A verified. The NPC attack clause (3b) and its test are gone from `lib/loka/content/lint.ex` and `test/loka/content_lint_test.exs`. `test/loka/lint_baseline.txt` holds 119 non-header lines, none under `npcs/`. Its header and `@baseline_cap` both say 119. `docs/CHECKS.md:105` and `docs/guides/area-authoring.md` drop rule 5, the engage rule that 3b covered.
- R1-B verified. `Lint.run/1` raises `ArgumentError` when no `cartridge.json` loads. The Mix task test covers a missing folder and the parent folder. `content_lint_test.exs`: 9 tests pass. Planted break (the raise removed): 1 failure, `mix loka.lint exits 1 on a finding and returns on none`.
- New findings: none.
