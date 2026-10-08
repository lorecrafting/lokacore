# The current system

These are the active system contracts (audited claim by claim at `87a1246`; later mechanic
clauses cite their governing records). A quoted name cites a test. The
[current bundled chapter](cartridge.md#current-bundled-chapter) owns the current release
identity. [DIFFERENCES.md](DIFFERENCES.md) records remaining differences for the owner.
History (the specification packet, ADRs, decisions and reviews) remains in its dated
records and [docs/archive/](../archive/README.md).

| File | Covers |
|---|---|
| [architecture.md](architecture.md) | repository layout, primitive composition and layer ownership, the compile-checked boundaries, hosts, checks, observability |
| [book-ui.md](book-ui.md) | book views, entries, actions/logs, destinations, scene/state rules |
| [Book component guide](../BOOK-UI-COMPONENTS.md) | current shared-client pieces and the page pattern to reuse for a new mechanic; Book UI above remains normative |
| [protocol.md](protocol.md) | contracts, the numeric profile, the decision loop, budgets, invariants, ActionSet, GameView |
| [save.md](save.md) | the local Story authority: receipts, the SQLite save, recovery, story points, the trace |
| [cartridge.md](cartridge.md) | source format, compiler, artifact, loader, installed capabilities |
| [glossary.md](glossary.md) | cartridge, blueprint, instance, spawn and capability vocabulary |
| [Builder's guide](../BUILDERS-GUIDE.md) | file-based authoring workflow and examples for current mechanics |
| [mechanics.md](mechanics.md) | the rules of each implemented capability |
| [owner-rules.md](owner-rules.md) | the active owner rules, one list, no history |
| [DIFFERENCES.md](DIFFERENCES.md) | where the code and the spec disagree, for the owner |
| [future.md](future.md) | planned work, each item linking its plan |

Generated and checked, so correct by construction (`bin/contracts.exs --check`,
`bin/features.exs --check`): the [feature map](../features.gen.md) (which capability is
implemented where, with its contracts, fixtures, invariants and transcripts), the
[contracts](../contracts.gen.md) (every schema contract, fields and examples) and the
[residency matrix](../residency.gen.json).

Executable contracts stay where they are and are not restated here: `protocol/`
([map](../../protocol/README.md)), `docs/spec/conformance/` (current fixtures and the
[numeric profile](../spec/conformance/numeric-profile.md)) and
[release scope](../spec/release-scope.md).

Chapter 1 A–D mechanics are published; E1–E3 remain open in the
[roadmap](../ROADMAP.md). The [M1–M23 queue](../NEXT-MECHANICS.md) records mechanic
planning and [future work](future.md) links later work. A plan alone does not establish
installed behavior. Native verification and the known UI blur carry remain deferred
under the [mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md).
