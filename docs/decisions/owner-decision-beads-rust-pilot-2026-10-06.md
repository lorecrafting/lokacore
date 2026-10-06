# Owner decision: pilot Beads Rust for Chapter 1 tracking

The owner asked on 2026-10-06:

> ok lets do a beads rust pilot, can you integrate that while still driving towards our goal?

Pilot `beads_rust` (`br`) on a small Missing Child subset while Chapter 1 source
work continues. Keep the [roadmap](../ROADMAP.md),
[completion plan](../MISSING-CHILD-PLAN.md), briefs, independent review records
and Git merge history as durable evidence. Beads mirrors operational status and
dependencies, with links to those records; it does not replace them or alter
source review/CI gates. The PM is the single tracker writer, whether the PM is
Codex or Claude Code. The pilot is reversible by retiring `.beads/` in a reviewed
change; the Git evidence remains.

The [delivery workflow](../WORKFLOW.md#beads-rust-pilot) owns sync, path hygiene
and the evaluation point after two source merges.
