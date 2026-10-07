# Owner decision: designer role for Book UI work — 2026-10-07

The owner added a `designer` subagent role.

Owner's words (paraphrased):

- A designer keeps the Book UI tight in any slice that changes what the player sees, not
  only in the polish lane.
- It owns and is the single writer of the design system: tokens (color, type, spacing,
  motion, light/dark), [the component catalogue](../BOOK-UI-COMPONENTS.md) with states and
  rules, and the interaction rules in [Book UI](../system/book-ui.md). Developers propose;
  the designer writes or approves spec text.
- Before work, it translates owner UI feedback or a slice's UI needs into design-system
  terms (which token, which existing component or pattern, any new state or component)
  for the brief.
- During work, it flags only one-offs (a raw color or size, or a component that duplicates
  an existing one) and otherwise stays quiet.
- In review, it gives an independent design review of the UI part of a diff it authored
  none of, with findings in the usual severity format, and writes the slice's spec rules
  in the same PR. For a pure UI polish batch, the designer review plus a quick correctness
  pass is the independent review; anything touching mechanics, save, protocol or kernel
  still gets the normal reviewer.
- It prefers checks over opinions: a rule that can be checked mechanically (for example,
  no raw hex or pixel literals outside the token file) becomes a check, written by a
  developer slice.
- Not its job: product scope, or overruling the owner on taste. The owner is the art
  director.
- Model: Opus.

## Effect

- [`.claude/agents/designer.md`](../../.claude/agents/designer.md) defines the role;
  [the workflow](../WORKFLOW.md#delivery-workflow-pm-developer-reviewer) routes to it and
  [Book interaction delivery](../WORKFLOW.md#book-interaction-delivery) has UI-changing
  slices consult it.
- No tokens or components are created by this decision; that is later polish work.
