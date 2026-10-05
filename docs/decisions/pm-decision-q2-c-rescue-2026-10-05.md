# Q2-C rescue: original Wren escort to Elspeth

PM decision, 2026-10-05. The approved second complete return path follows merged
PR189's complete stays path. Chapter0.0.12/API1.11 adds escorting original Wren, real
death separation and explicit Rejoin, then the distinct rescued terminal. Both return
paths remain complete. New independent hash/IDs preserve older frozen answers and
exact old-pin refusal; no compatibility adapter is required.

## Composition record

Consumer: Wren's post-riddle start, actual Move/Flee, fatal player death, co-located
Rejoin and Elspeth rescued turn-in. Shared reads: current dialogue policy, living bound
participants, active actor quest, physical source room and typed escort status.
Typed writes: escort.transition and immutable actor/body/NPC/quest/start-choice identity;
branch/status fact assignments; original ChoiceRow resolution; quest resolution and
conserved containment transfers. Dialogue writes effects and facts/quest/choice in its
root group; Move/Flee write player/NPC transfers in the existing movement group; death
writes separation in its existing fatal-combat group. The existing proposal composes
and validates all operations before one receipt transaction and memory adoption.

Reuse dialogue, policy, facts, quest, movement/Flee, death/corpse, structural sharing,
SQLite state_row/receipts and Book details. Missing invariants are immutable original
escort identity, one row per actor, legal status edges, truthful physical following,
mutually exclusive branch/terminal evidence and cold-open consistency. These require
one typed escort relation and effect, not a party/AI/pathfinding framework or Boolean
follower fact. Governing clauses: [chapter](../system/cartridge.md#q2-c-rescue-return),
[mechanics](../system/mechanics.md#escort1), [protocol](../system/protocol.md#typed-escort-relation),
[save](../system/save.md#escort-and-alternate-return-recovery), [Book](../system/book-ui.md#escort-details).

Verify actual Move and Flee, fatal combat separation, reciprocal return/Rejoin, both
terminals, literal bound IDs, Book/SQLite rollback/reopen/unknown-COMMIT and malformed
evidence. Plant movement and trust-boundary mutants; schema sweep and two-kernel
composer checks apply. Fresh primary and separate protocol/save review follow source CI.
No preview, Metro, Simulator, DeviceHub, native work or owner-save activity.
