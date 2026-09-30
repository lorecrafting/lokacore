# Owner decision: autonomous PM, escalation ladder — 2026-09-30

Relayed verbatim by the PM (Claude Code) from the owner's chat. No checker can verify these
quotes against the chat. Spelling is the owner's.

Amends §3 of the [R3 lanes decision](owner-decisions-r3-lanes-2026-09-24.md): "anything open
after fix round 2 ... still go to the owner" now goes up the ladder below first.

Owner's words:

> continue please without asking to contiue to next workflow item or not

> can you put a clause in the workflow or something or somewhere that will prevent that from happening, meaning, you dont need to ask my permission for normal workflow steps, just keep going until the overall PR or slice or whatever is done, however you want to word it

> and only ask UNLESS its critical things but for the most part stay autonomous. If it needs to kcik decisions up to a highe rmodel then do so, but i think we have /advisor on, if that doesnt work then kick it up manually, and if cannot then stop for human input, im just trying to design it so that its autonomous as much as possible unless absolutely needed human intervention

Effect ([workflow, Keep going](../WORKFLOW.md#loop)):

- The PM runs a slice to its merge without asking at each step.
- Hard decisions go up a ladder: the `advisor` tool, then a higher model by hand (Fable, or
  codex Astra for a hard review), then the owner only if both fail or the matter is critical.
- A ladder answer is advice to the PM. It never changes a reviewer's finding or verdict and is
  never the owner's OK; the merge gate (APPROVE and every CI job green) is unchanged.
