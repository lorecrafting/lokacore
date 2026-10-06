# C2 Watchman's Rounds — source-assignment re-pin review

Reviewed exact source `b3790b7299a05b128f1dc3f3a74813c31914e36b` against published main `cc43d0186e70231d7ba25bf73da61e6838c0bf06` on 2026-10-05. PR: null. I authored none of the source-assignment change.

**Verdict: APPROVE.** No findings. This approves the documentation re-pin for assigning C2 source work; implementation, successor pins, source review and playable proof remain ahead.

## Review criteria

The [adopted C2 decision](../decisions/pm-decision-c2-watchmans-rounds-2026-10-05.md), [approved plan review](2026-10-05-c2-watchmans-rounds-plan-review.md), [complete-chapter dependency row](../MISSING-CHILD-PLAN.md#c-watch-combat-and-survival), and selected [mechanics](../system/mechanics.md#s3-finite-watch-patrol-c2-selected-contract), [cartridge](../system/cartridge.md#c2-watch-route-and-trust), [protocol](../system/protocol.md#c2-patrol-composition-and-admission), [save](../system/save.md#c2-patrol-attempt-recovery) and [Book](../system/book-ui.md#c2-watch-patrol-details) clauses require an integrated B1/C1/Q2-C-rescue base and a truthful current artifact pin before source assignment. The brief must keep the finite causal patrol, all-hours recovery, original Tobin and Wren independence, trust-only reward, typed save proof and current mobile pause. Concurrent shared release edits require a new base pin; future C2 identity and verdicts remain unknown.

## Evidence and scope

- Published main `cc43d018` is the source branch's direct parent and contains the reviewed C1, B5 and B4 integrations. Their primary and save/protocol review records close the source findings; roadmap publication is #205 for C1/B5 and #206 for B4. B1 and Q2-C-rescue are already integrated at that base.
- The `missing_child_v021_hash.json` known answer at that exact main tree declares chapter `0.0.21`, minimum kernel API `1.19` and SHA-256 `a274bb1c6b22306718648bbcb1b967ee017e0420b62589afe10e1009434dbbfa`; `missing_child_v021_ids.json` has 94 entries. The brief records those values exactly.
- The four-file diff changes assignment status and dependency pins. It preserves the selected patrol, explicitly leaves C2 successor release/API/hash/IDs and implementation verdicts null, and requires re-pinning after an intervening main merge. B6/B7 are not dependencies in the public C2 row or selected contract.
- No code, fixture, save, browser or native state changes are part of this review. A docs-only slice needs no mutation test. The review record and index passed the documentation checks and normal commit hook.

Ponytail Review: Lean already. Ship. The re-pin adds no implementation machinery or duplicate policy; the source brief links the governing clauses and existing review records.
