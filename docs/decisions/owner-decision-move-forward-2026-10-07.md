# Owner decision: move forward, lessons first, 2026-10-07

Owner direction (paraphrased):

> Delete all old branches we don't need. We want a "move forward" policy so we move faster,
> and we don't want to keep legacy things unrelated to our new direction: old fixtures, old
> historic material and so on. Keep only valuable lessons that can later shape systems that
> prevent similar classes of failure. Lean toward discarding when unsure; start fresh.

> Propose an owner-decision PR that trims old evidence, archived specs and superseded review
> records, and first pull their lessons into docs/lessons.

On the frozen conformance fixtures, the owner delegated the call (paraphrased): keep them if
they are valuable, or lift the rule until things stabilize and reinstate it; the PM decides.

PM decision under that delegation: keep the frozen conformance fixtures in `protocol/`; they
are the cross-kernel source of truth, not legacy.

## Rule

The repository keeps the current system and the lessons, not the history. Before deleting
records, fold each recurring failure class they show into [docs/lessons](../lessons/), stated
as the class, the rule or check that prevents it and one permalink to its strongest source.
Then delete records of closed or superseded work. A link to a deleted file becomes a GitHub
permalink pinned to the last commit that held it; git history keeps every byte.

Kept, and why:

- `protocol/` and every conformance fixture: the cross-kernel source of truth (PM ruling).
- `docs/system/`, `docs/lessons/`, ROADMAP, WORKFLOW and CHECKS: the current system and its
  rules. Records they cite only as proof of closed work become permalinks.
- Decision records in force: those linked from [owner rules](../system/owner-rules.md),
  AGENTS.md, WORKFLOW, CHECKS or `docs/system`, plus owner records of current process.
- `docs/archive/spec/`: protocol schemas cite its sections (`04 §7`), and
  `test/loka/core/registries_test.exs` reads the invariant citations from it.
- Archive decision records in force or named by `protocol/`, code, lint or tests, and
  `docs/archive/ROADMAP.md`, which a protocol schema names. They stay at their paths so
  those references hold.
- Open work: E1–E3 briefs and their index, evidence and reviews; the baseline audit ROADMAP
  requires before E1 certification; the CI scope audit CHECKS uses as the current gate's cost record; the Chapter 1 documentation and
  architecture audits that E3 closure needs; records an open Beads task cites.
- Any file read by code, tests, checks, CI or hooks.

Records of closed or superseded work are deleted: the rest of `docs/archive`, evidence and
reviews of closed slices, closed-slice briefs and decision records no index lists as in force.
This narrows the [review knowledge trail](owner-decision-review-knowledge-trail-2026-10-05.md):
findings of closed work survive as lessons and permalinks, not as files in the tree.
