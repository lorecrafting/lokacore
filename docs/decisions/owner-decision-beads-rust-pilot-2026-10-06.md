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

The [delivery workflow](../WORKFLOW.md#beads-rust) owns sync, path hygiene
and the evaluation point after two source merges.

The owner expanded the pilot on 2026-10-06:

> can you put all 33 chapter one tasks in beads rust? so i can see their dependency graph and stuff?

Mirror all 33 completion-plan slices and their hard in-plan dependencies. Mark
published source closed, active source in progress and unbuilt source open.
External prerequisites and conditional dependencies remain stated in the plan
until they become definite; do not invent extra tracker tasks to represent them.

The owner expanded the pilot again on 2026-10-06: allow hooks and deeper
integration, and preserve comparable observations from before and after hooks.
Use the repo-owned, opt-in Git import hook described in the
[workflow](../WORKFLOW.md#beads-rust). It updates only the local Beads index
after Git advances the selected integration checkout. Git reviews, source gates,
roadmap publication and PM-owned task closures stay as before. The same hook
runs for Claude Code and Codex because it belongs to the checkout, not an agent
session. The workflow also gives the PM a simple ready → building → merged
lifecycle using `br update`, `br close` and `br ready`, with reviewed records as
the evidence. The [comparison record](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-beads-hooks-pilot.md)
holds the baseline and post-hook observations; do not claim a speed improvement
until real merges have supplied comparable data.

## Pilot observations for the keep-or-retire decision

- The pilot could show ready, blocked and active slices in `br` and a dependency
  graph in `bv` without replacing the roadmap or briefs.
- The full import exposed a Beads Rust reserved-ID rule: an ID containing
  `-wisp-` is treated as ephemeral even when its task is durable. B6 (S4 Wisp)
  was present in local SQLite but omitted from the Git export. Independent review
  caught the 32/33 mismatch. B6 now uses a safe ID, and the export check refuses
  missing plan slices, dangling dependencies and reserved IDs.
- The local SQLite index needed a documented `br doctor migrate-schema recover`
  after a write reported recovery-in-progress. The tracked JSONL remained the
  reviewable record.

At the next two source merges, compare status accuracy, graph usefulness,
Claude/Codex handoff and the time spent on tracker maintenance. Record the
observations here, then keep or retire the pilot through a reviewed change.
