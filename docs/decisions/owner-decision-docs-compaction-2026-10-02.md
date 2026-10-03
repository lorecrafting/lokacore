# Owner decision: docs compaction after Gate R6P, written by Fable — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

The owner asked whether the repository could keep a thin description of what the code does now,
with the history kept in an archive, so that every brief, build and review reads less. The PM
measured the docs (about 115k words of spec, 183k of reviews, 20k of decision records, and a 4.9k
ROADMAP read by almost every agent) and proposed a compaction stage. The owner agreed:

- **When.** One docs-compaction stage after Gate R6P, before the [presenter split](owner-decision-presenter-split-2026-10-02.md),
  so the presenter split already works from the thin docs.
- **What.** A thin "current system" doc set that describes what the code does: architecture, protocol
  and save format (pointing at the schemas), cartridge format and installed capabilities, the rules
  of each mechanic, and the active owner rules as one current list without history. Done ROADMAP
  stages shrink to one line each. Old specs, ADRs, decision records, reviews and old ROADMAP rows
  move to `docs/archive/`, with an index; agents read the archive only when a task needs the history.
  Executable contracts (`protocol/`, conformance fixtures, known answers) stay where they are.
  Future-plan spec sections move to the archive as plans, linked from a short future-plan list.
- **Accuracy.** Each claim in the new doc set is checked against the code and its tests. Where the
  code and an old spec disagree, the doc follows the code and the difference is listed for the owner.
- **Model.** The owner chose Fable to write the compaction, an exception to the
  [review rules](../archive/decisions/owner-decision-review-rules-2026-10-01.md) that keep Fable as a codex stand-in only.
  An independent reviewer still checks it.

Effect: [ROADMAP](../ROADMAP.md) Docs compaction row.

## Decisions for the move (2026-10-02)

Relayed by the PM after PR #117, **(paraphrased)**:

- **Source of truth** after the compaction: `docs/system/` (thin, checked against the code) plus
  `protocol/` and the conformance fixtures. A change amends `docs/system` first, then the code.
  The old specs move to `docs/archive/` as history, read only when a task needs it.
  [AGENTS.md "Specification (source of truth)"](../../AGENTS.md#specification-source-of-truth) is
  rewritten to say this; it replaces the old spec README §11 ("amend the spec here first") and
  the §8 normative map.
- **Decision records:** `docs/decisions/` stays live for new records, each adding one line to
  [owner-rules.md](../system/owner-rules.md); the older records move to `docs/archive/decisions/`.
  The records of 2026-10-02 still in force stay in place.
- **ROADMAP:** a finished stage is one line; its history moves to the
  [archived roadmap](../archive/ROADMAP.md), indexed so the docs checker reaches every moved file
  with no exemption.
- **Stays in place:** `protocol/`, `docs/spec/conformance/`, `release-scope.*` and `IMPORT.md`.

Effect: PR #117 (`docs/system/`) and the move PR.
