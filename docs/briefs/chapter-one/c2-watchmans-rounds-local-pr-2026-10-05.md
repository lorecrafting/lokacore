# C2 Watchman's Rounds — local source handoff

The original Tobin now leads a finite, player-triggered patrol. Start grants no
checkpoint; Continue moves only Tobin, and ordinary player entry earns unique
checkpoint credit. Detours pause until explicit Rejoin. Actual fatal player combat
clears the current attempt before shrine return; immediate Restart preserves the
quest and leader cursor but starts a new empty attempt. The fourth distinct join
resolves S3 and grants trust alone, without money, equipment or learning.

Published base: `80c3a072` (reviewed B6/B7 mechanics plus C3 planning only).
The labelled B6 Talk selector preserves original unlabelled C1 lessons. Local
candidate chapter/API and independently derived hash/IDs live in the
[C2 brief](chapter-one-c2-watchmans-rounds-brief-2026-10-05.md); no remote PR,
push, merge or source approval is claimed here.

Implementation uses one quest-instance-keyed typed patrol row, full-prior portable
transition and independent lifecycle invariant. Shared exact keyed admission
carries the drawn quest/attempt/cursor/status through GameView, Book and authority.
Movement and death retain their own player/Wren/corpse writes. Changed-row SQLite
receipts use the existing replay proof; there is no save migration, snapshot,
scheduler, new identity allocator or general objective interpreter. The compiler
and loader reject competing original-leader writers, ordinary reserved trust
writes and independent activation/resolution of the patrol quest.

Validation and retained proof: [C2 evidence](../../evidence/2026-10-05-c2-watchmans-rounds/README.md).
Focused real chapter checks include original C1 payments/reopen, original Wren
following through actual fatal cellar combat and cold Restart, leader-ahead death,
all-hours public routes/readables, every selected cold boundary, corrupt causal
receipts and both uncertain-COMMIT outcomes at departure and final join.

Ponytail Review: lean; the duplicate receipt-replay implementation was removed in
favor of the existing replay helper. No dependency, compatibility adapter or
speculative framework was added. The actual-diff correctness pass checked original
Tobin identity, leader/player transfer ownership, unique ordered credit, fatal
reset, exact drawn input, quest/trust atomicity, event positions and lawful later
travel. This self-review is not independent approval.

Runtime proposal, creation hydration and corpse custody were not changed. Native
build/simulator work and blur polish remain deferred. The [primary](../../reviews/2026-10-05-c2-watchmans-rounds-primary-review.md) and
[save/protocol](../../reviews/2026-10-05-c2-watchmans-rounds-save-second-review.md)
reviews approve exact source `74711349`. The later
[UI proof scope](../../decisions/owner-decision-mobile-focused-c2-ui-proof-2026-10-05.md)
changes verification only and requires its separate docs review. Full active checks
run at accumulated publication under the normal workflow. Published C2 source/PR/verdicts remain null.
