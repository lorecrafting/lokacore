# B6 Wisp riddle and Ward — local draft PR

Branch: `chapter-1/b6-wisp-ward`. Source assignment base:
`fe25fe07702a957e4731eb4254ea4385e09b1e4b`; B7 predecessor:
`547f809ccdd587498dee86cb14822f564efee642`. Exact implementation source:
`e7aeace7f369254e3fb4b3f197dc1b641b6e6e87`. Independent B6 primary and save/protocol
reviews: APPROVE on that source. Hosted PR/CI and browser/native proof: null.

The player can reach Marsh Light, Old Causeway and Tide Flats at any hour, douse
carried light, Seek the visible glow and accept the Wisp's optional riddle.
Three wrong answers close only that sitting; Ask again immediately opens at zero.
A correct answer resolves S4, learns Ward once and exposes the exact public Aldric
ward discussion. The Book uses confirmed state and keeps sent answers on uncertain
commit for exact retry.

Governing clauses: [S4](../../system/mechanics.md#s4-all-hours-wisp-b6-selected-contract),
[route/tuning](../../system/cartridge.md#b6-marsh-route-and-tuning),
[composition](../../system/protocol.md#b6-bounded-sitting-and-topic-composition),
[save](../../system/save.md#b6-discovery-sitting-and-ward-recovery),
[Book](../../system/book-ui.md#b6-seek-retry-and-ward-details),
[adopted brief](b6-wisp-ward-riddle-brief-2026-10-05.md).

v023/API1.21 includes reviewed B4 light, B5 herbs and B7 waterskins. Independent
Python JSON/SHA-256/UUID derivation begins with frozen B7 v022, overlays only B6
source additions, and yields 103 initial IDs and artifact SHA-256
`e7333f694e6ec2c9f02a39944d994d4452f26fffc5534ff217346504471e4c71`.
Frozen predecessor answers remain intact; save mismatch is explicit and never deletes progress.

The implementation composes existing ActionSet, policies, attributes/check events,
dialogue/quest/fact lowering and changed-row commits. `choice.attempt` has portable
TS/Elixir literal and seeded differential proof. Perception and topic gameplay remain
TS-first. Labelled authored Talk controls select their exact dialogue; unlabelled
existing controls preserve first-eligible Q1/report behavior. Save recovery verifies
source/actor/quest/count associations through bounded per-sitting receipt history.
No new table, dependency, source-size allowance or `runtime/proposal.ts` change.

Ponytail Review: removed duplicate opening-receipt lookup, reused existing visibility,
choice/receipt and Boolean fact machinery, and trimmed redundant module comments
instead of raising size budgets. Actual-diff correctness review caught immutable role
binding drift and restored saved-ID semantics with an independent declared-key guard.
A broad Story/Book run caught unlabelled Talk routing drift; exact selection now opts
in through authored labels. Both independent reviews approved the exact source.

Focused and full headless checks, mutation results and the schema sweep are retained in
[proof](../../evidence/2026-10-05-b6-wisp/README.md). Native/mobile simulation remains paused.
