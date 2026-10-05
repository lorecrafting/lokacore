# PM decision: Q2-A — first Missing Child search lead — 2026-10-05

The PM adopts one consuming PR for exact Q1 report → active Q2 → explicit Study tracks.
[Cartridge authoring](../system/cartridge.md#source-layout) defines the player contract;
[reactions](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts),
[Notice projection](../system/protocol.md#notice-board-projection),
[Book details](../system/book-ui.md#notice-board-details) and
[structured receipt recovery](../system/save.md#opening-a-story) define its shared consumers.

Adopt the bounded current-state track-fact objective as the first search lead for this release.
Study changes the journal while Q2 stays active; its prose explicitly leaves Wren unfound.
No Q2 resolution or turn-in is authored. Full search objectives, boot, rescue, light/swim,
bell loss and scenes wait for their actual consumers. Exact cartridge copy is delegated to
the developer within this contract under the [copy delegation](owner-decision-copy-delegation-2026-10-04.md).

This mechanic composes quest resolution and activation through the existing FIFO reaction
queue, recipe policy and fact assignment, Notice offers and Book buttons, and changed-row
receipt persistence. No new event, dispatcher, row type or transcript is introduced. Read
remains observation-only. Source instance evidence binds activation to its actor; all prior
Q2 instances, including terminal rows, prevent restart. Unknown exact save pins remain intact
and refused until explicit Start over. Release/API/artifact and allocation pins are derived
from reviewed main independently; historical fixtures remain frozen.

API1.8 deliberately changes ReactionRule apply items to a tagged consequence union. The PM
approves changing the one existing invalid fixture's unknown `event.emit` diagnostic from
`const_mismatch` plus unknown `x` to `unknown_variant`, preserving its input and other errors.
The shared schema compiler rejects missing/invalid discriminator declarations; other new
required fields and constraints use literal data fixtures in both validators. No frozen semantic
conformance answer or unrelated historical fixture is changed.

Developer validation: [headless checks and red controls](../evidence/2026-10-05-q2-a-first-search/README.md).
