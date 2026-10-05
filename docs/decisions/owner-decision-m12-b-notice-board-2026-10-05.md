# M12-B: nested notice board

Owner direction (paraphrased by PM): add the board nesting with the first multiple real
chapter notices: World → board detail → notice detail → Back to board → Back to World.
All details show title, description, a chronological log only when nonempty, then options.

## Adopted scope and composition record

The consumer is the Drowned Lantern board in `ashmere_missing_child@0.0.4`, with Lost tin
whistle and Help in the cellar. Ferry Landing opens a direct Landing notice detail and invokes
its existing Read. Each notice displays the body on confirmation without a second Read
option. Landing offers Leave to World; a board child offers Back to board. Confirmed Read
messages appear only in their notice detail histories, never in World. Cold reopen derives
the exact target from the committed receipt without a save-format or writer change. Old Bram
remains outside the active chapter; the sampler and Q1 are outside this change.

Reuse inspectable detail identity, selected description variants, readable@1 admission and
confirmed narration, GameView, the Book's Page[] stack and presenter detail histories.
Shared reads are the current room, bounded authored board membership, description policies,
and exact current Read offers. Read owns the existing narration consequence; authority owns
the receipt/transaction/adoption. Board navigation writes only local presentation state.
No new durable state, gameplay writer, foundation change, proposal change or save format.

The missing invariant is bounded distinct same-room ordinary readable membership. Compiler
and loader validate it and all title TextKeys before projection. No recursion or body text
is projected. Read admission remains canonical, including aliases, policy, scene/combat and
staleness. The Book invokes the exact captured offer and reveals only confirmed narration;
clock redraws retain valid routes, room changes prune them, scene/combat take precedence.

This composes current detail presence, policy-selected descriptions, action admission and
receipt recovery without named chapter/NPC rules. The content-specific prose merely points
to Maud's existing quest; it grants no fact, quest or reward. No new conflict/rollback or
causal-credit path exists. Controlled projection, compiler/loader, UI and SQLite recovery
checks cover these new boundaries; existing Read/save proofs remain applicable.

Normative behavior: [Book UI](../system/book-ui.md#notice-board-details),
[cartridge](../system/cartridge.md#notice-board-metadata),
[protocol](../system/protocol.md#notice-board-projection), and
[readable](../system/mechanics.md#readable1-mechanicsreadablerulets).

Developer validation: [headless evidence](../evidence/m12-b-notice-board/README.md).
