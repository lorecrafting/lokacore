# Independent review: opening Elspeth (PR #183)

- Reviewed commit: `1614da513479b12b6bbef356c888e6ccf576b243` against `1978c5e0`
- Verdict: **APPROVE**

## Requirements derived before inspecting the diff

1. [The active cartridge contract](../system/cartridge.md#source-layout) and [opening decision](../decisions/owner-decision-opening-elspeth-2026-10-05.md) place Elspeth at Ferry Landing at every hour. Her conversation introduces Wren and gives the north route through Well Lane to Village Green and the east turn from Well Lane to the Drowned Lantern and Maud.
2. The dialogue is informational: Talk and replies add no quest, fact, reward, or Q1 acceptance. [Book NPC details](../system/book-ui.md#npc-dialogue-and-action-details) retain the replies in that detail's history rather than the World log, and Leave returns the player to the north route.
3. The phone bundles the new `0.0.5` chapter and its independent known-answer/hash and allocation fixtures; older release fixtures and saves retain their identity.

## Review

The NPC has a fixed `ferry_landing` room and no schedule. All three replies are ordinary narration choices without state operations. The two directions match real exits and Maud's placement. The Book test exercises the rendered detail, each reply, empty World log and journal, unchanged persisted story rows, Leave, and both routes. The bundled artifact and save pin use `0.0.5`; the prior fixture remains intact. Fixture regeneration produced byte-identical hash and ID files. Comparing `v004` with `v005` found only the Elspeth NPC, dialogue, and text additions among definition and catalog keys.

Checks: `mise exec -- bin/check_all.sh` passed; focused Book, chapter, and local-story tests passed (11/11); focused Elixir compiler test passed (1/1). Two independent throwaway artifact mutations failed the new Book test: placing Elspeth in Well Lane, and changing the inn reply to a southward direction. The mutation checkout was discarded. No Simulator, Metro, DeviceHub, or preview was used.

Ponytail review: lean already; no unnecessary abstraction or duplicate machinery found. Correctness findings: none.
