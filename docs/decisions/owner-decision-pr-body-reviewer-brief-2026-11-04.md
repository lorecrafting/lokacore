# Owner decision: a PR body is the reviewer's brief — 2026-11-04

Written 2026-11-04 in Claude Code (PM). The owner's words are paraphrased.

Owner, 2026-11-04 (paraphrased): keep PR bodies, since reviewers work from them; write them for
accurate, good reviews, with nothing extra.

## Effect

A PR body has these parts, each only when it has content, and nothing else:

1. **What and why**, at most five lines, and the governing `docs/system` section.
2. **Where to look**: the risky spots, the decisions taken and the reason, and what was not checked.
3. **Tests**: one line per new or changed test: the break it catches and its red-control result.
4. **Composition record**, for a slice that adds or changes a mechanic.
5. **Self-review**: the `/code-review` result; each open item with `file:line`.

Left out: screenshot path lists, check and CI log dumps, full `mutate_diff` output (it stays in the
developer's handback), restated spec text and narrative. Every claim and `file:line` stays copied
from a run in the same turn ([developer](../../.claude/agents/developer.md), step 3).
