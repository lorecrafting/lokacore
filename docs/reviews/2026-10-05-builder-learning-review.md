# Builder's Guide reuse lessons — PR #197

Reviewed `8971c7ed7f1ae1f6896b0b7233e7e54d889ca774` independently. **Verdict: APPROVE.**

## Requirements derived before the diff

- The guide must point builders to the current Missing Child cartridge and its real chapter examples; Old Bram and the Lantern sampler are outside the active chapter ([cartridge source](../system/cartridge.md#source-layout), [owner rule](../system/owner-rules.md#product-and-scope)).
- Combat and same-body shrine return are installed and used by the bundled chapter, while remaining chapter work is planned rather than claimed complete ([cartridge source](../system/cartridge.md#source-layout), [death mechanics](../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation), [completion plan](../MISSING-CHILD-PLAN.md)).
- The guide should route to active specifications, lessons, review records and executable checks without duplicating contracts or implying every historical finding has an automated guard ([AGENTS.md](../../AGENTS.md#specification-source-of-truth), [workflow](../WORKFLOW.md#loop)).

## Review

No findings. The linked Missing Child item, rat, fact, quest and Elspeth dialogue sources exist; the active manifest locks `combat@1` and `death@1` and configures shrine return. The learning paragraph distinguishes review records from executable guards and leaves exact behavior with the active specification. Ponytail review: lean already; no added process or duplicated mechanics contract.

`mise exec -- elixir bin/check_docs.exs`: pass, 487 docs, zero broken links, zero unreachable. `git diff --check`: pass. PR checks at the reviewed head: `changes` and `lint` pass; code jobs skip for the docs-only diff. Mutation testing is inapplicable to this documentation-only change.
