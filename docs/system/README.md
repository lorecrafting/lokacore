# The current system

What the code does now, checked claim by claim against the code and its tests at `87a1246`.
A `path:line` cites that commit; a quoted name cites a test. Where the code and an old spec
disagree, the text follows the code and [DIFFERENCES.md](DIFFERENCES.md) lists the
difference for the owner. History (the specification packet, ADRs, decision records,
reviews) is in [docs/archive/](../archive/README.md), read only when a task needs it.

| File | Covers |
|---|---|
| [architecture.md](architecture.md) | repository layout, primitive composition and layer ownership, the compile-checked boundaries, hosts, checks, observability |
| [book-ui.md](book-ui.md) | book views, entries, actions/logs, destinations, scene/state rules |
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

Planned mechanics beyond C1: [M1–M23 queue](../NEXT-MECHANICS.md) and [first M1-A brief](../briefs/m1-a-clock.md), reachable through [future work](future.md). These plans do not describe installed behavior.
