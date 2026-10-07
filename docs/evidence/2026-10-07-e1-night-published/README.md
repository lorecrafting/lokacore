# E1 Night in the Marsh after the published checker fix

Isolated `proof/e1-night-watch-paths` is re-pinned onto published main `aa138a73a20de5e14aab5a35ce848e1e700e5733`, which includes the independently approved [C6 checker fix](../../reviews/2026-10-06-e1-expedition-invariant-review.md). Author source is `b47d3852198e1949de7c51b02f10576aa9dd7122`. The [Night recipe](../../../kernel/ts/test/e1_night_marsh.ts) and [focused test](../../../kernel/ts/test/e1_night_marsh.test.ts) use the existing production authority and real Node SQLite; no checker override or hidden state writer is introduced. Night remains unregistered here; E1 certification is pending.

## Literal route

The [S27 contract](../../system/mechanics.md#c6-s27-night-in-the-marsh-selected-planning-contract) and [authored route](../../system/cartridge.md#c6-s27-expedition-declarations) govern the answers. Fresh road-born walks to Hound Run and deliberately Starts. The original active attempt has cursor zero, survival false and faction zero; a real C4 hound encounter is present. Legal Flee clears that encounter. Adder Nest/Hound Run detours earn zero entries; the fixed retained seed takes Adder Nest. The five ordered route entries reach Reed Bank, Willow Shade, Drowned Oak, Willow Shade and Reed Bank with literal cursors 1/2/3/4/5. Cold SQLite reopens occur before later consumers. Use shelter at cursor three explicitly sets sheltered true while retaining cursor three and the same clock. Completion preserves the original occurrence/attempt, resolves the quest as `completed`, sets survival true and applies faction −1. Returning to Hound Run and requesting another Start refuses `invalid_state`; another reopen retains cursor five, survival true and faction −1.

`night-marsh.jsonl`: 15 recorded commands and 10 cold reopens. `watch-rounds.jsonl`: the earlier independently reviewed watch route rerun on the same published-fix source, 31 commands and 24 reopens. Both carry actual source/check/policy, content/artifact and separate recipe/test byte digests. The recorder's old explicit check-file list is not expanded in this isolated author branch; integration must add `e1_night_marsh.ts` and the other registered recipes to that digest. These unregistered author receipts remain `certification: false`.

## Controls and retained replay

- `green.log`: existing cases, watch and new Night pass (four tests, exit 0). Night and watch each repeat from a fresh database, compare deterministic digests and replay all commands through `AUTHORITY_KERNEL`. TypeScript typecheck, formatting and focused size checks pass.
- `fifth-entry-*`: omit only the fifth player route entry; old cases/watch stay green (exit 0), new Night fails (exit 1).
- `shelter-*`: omit only the actual shelter invocation; old cases/watch stay green and new Night fails (exit 1). Both source mutations are restored.
- `retained-replay.log`: reconstruct the admitted fresh world using retained identity/RNG and verify its initial-state hash. Both new traces replay without an invariant failure. The [original five-command failure receipt](../2026-10-06-e1-night-watch/README.md), pinned to `a1322ea`, now also replays without the old false `delta_preconditions_hold` on the published-fix source. Its original raw JSONL, reported failure and all byte hashes remain unchanged; this is a new-source comparison, not rewriting the old receipt.

Capture redaction covers local paths. World/entity IDs are deterministic proof inputs, not owner-device identifiers. Existing frozen v042 bytes are reconstructed from `protocol/fixtures/missing_child_v042_hash.json`. Node SQLite is the only host claimed; no owner save, app/browser lifecycle, native build, Wait, timed sleep or candidate mutation is exercised.

## Still pending

This proves only the selected legal Night success/shelter/once route and the rerun watch route. Night footprint failure/death/Restart, transaction fault/retry schedules, exact authored obligation bindings and final source-bound gate receipts remain separate work. Registration and source-digest expansion await integration; fresh independent Night review is required. No recorder edit, additional full gate or final 10,000 run is part of this checkpoint. This documentation commit follows the captured author source and issues no final certificate.
