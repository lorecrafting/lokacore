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
  - M1: drop the `silent` test.
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
   - Failure scenario: loka-kgd.184 marks reactions silent. A kernel built before this schema then rejects the showcase with SCHEMA_VIOLATION, not KERNEL_API_RANGE_INVALID.
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
