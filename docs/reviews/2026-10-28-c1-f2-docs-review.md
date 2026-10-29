# Review: C1 slice F2-docs, drop per-field kernel_api floors from docs and schema descriptions (loka-ivjq.2)

- Branch `simplify/c1-f2-docs` (no PR), reviewed head `4447ccd055b74a254d0609970ae8571593e19986` against `908f2a059` (#488 merge).
- Governing: `br show loka-ivjq.20` C1 PLAN, decisions D3, D4 and D9, and "Slice F2-docs". Owner yes on 2026-10-28: one kernel_api range check per cartridge and no per-field floors.
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- CI on the reviewed head: ci success, book-e2e success.
- Verdict: **APPROVE WITH NOTES**. The reviewer fixed one small should-fix in place (batch S rule).

## Must be true (written before reading the diff)

1. No semantic rule is lost along with a floor clause.
2. Every edited schema description still describes its field.
3. Artifacts, conformance and hash fixtures are unchanged.
4. `docs/system/cartridge.md:23` states the one range rule exactly as `Requires.range/2` on `origin/simplify/c1-loader` emits it.

All four hold:

- **1.** I sampled the cartridge.md, protocol.md, mechanics.md, MECHANICS-TOOLBOX and area-authoring edits. Every removed schema fragment contains `kernel_api`, `API` or `1.x`. The remaining `API1.x` labels are history, kept on purpose.
- **2.** Descriptions read whole after the cut.
- **3.** `git diff --stat` over protocol/fixtures, cartridges and artifacts is empty.
- **4.** The code is `version(low) >= version(high)` → `KERNEL_API_RANGE_INVALID` at `cartridge.requires.kernel_api` (content_test.exs:338-352).

Acceptance greps are clean and `check_docs` passes.

## Findings and rulings

1. **Should-fix, fixed by the reviewer.**
   - Where: `docs/system/mechanics.md:3496`, the kitchen sampler.
   - Problem: it cited `protocol/fixtures/loader_floors.json`, which F2-Ex deletes. After the merge, a live system doc would point at a missing file.
   - Fix: removed the cite (one line).
2. **Ruling (a): leave as is.**
   - Where: `protocol/cartridge.schema.json:1197`, where the elapsed-policy stage still lists `KERNEL_API_RANGE_INVALID`.
   - Reason:
     - The Elixir `elapsed/2` no longer emits it.
     - The stage list describes the TS loader, and TS `timeStage` (`kernel/ts/src/content/cartridge.ts`, about line 167 on c1-loader) still pushes it.
     - B2 deletes `timeStage`, and slice F rewrites the stage list (D3, D9).
     - Editing it now would make it wrong against the integration head.
3. **Ruling (b): both deletions accepted.**
   - "Range validation remains" is superseded by the single rule at cartridge.md:23.
   - The "1.14 legacy debt" and "quest_failed needs 1.46" sentences were pure floors.
4. **Ruling (c): leave docs/lessons/pm.md:11,34,45 for slice F.**
   - Lines 11 and 34 are dated lesson history.
   - Line 45 is a process list. Slice F should drop `loader_floors.json` from it.
   - None of the three is a `path:line` pointer, so check_docs does not flag them.
5. **Noted, not a finding.** Until the S7 slices land, the docs say no field carries a floor while about 50 TS loader floors remain. This is the planned order (D3).
