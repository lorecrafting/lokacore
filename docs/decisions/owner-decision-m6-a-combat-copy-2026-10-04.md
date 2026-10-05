# Owner decision: first live fight copy — 2026-10-04

The owner approved this exact seven-line batch in an asynchronous reply, relayed by
the PM on 2026-10-04. The approval summary here is paraphrased; the catalog text below
is verbatim. This is LegendMUD-inspired original wording, not a verbatim LegendMUD
quotation. It supersedes the temporary working copy for these seven keys only.

| Catalog key | Approved text |
|---|---|
| `item.brass_key.room` | A small [brass key] lies here, its narrow tooth glinting. |
| `combat.player_hit` | Your blow strikes the rat squarely. |
| `combat.player_miss` | The rat darts clear of your blow. |
| `combat.npc_hit` | The rat sinks its teeth into you. |
| `combat.npc_miss` | The rat snaps at you, but finds only air. |
| `combat.player_died` | You crumple to the floor. You awaken at the shrine. |
| `combat.npc_died` | The rat gives one last shudder and lies still. |

The brass-key line removes the obsolete cellar-key reference. The six combat lines
belong to the cartridge catalog and are selected through `world.combat.narration`,
as specified in [first encounter authoring](../system/cartridge.md#first-encounter-authoring-m6-a).
No other authored prose is included in this approval.
