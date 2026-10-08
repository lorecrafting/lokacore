# Owner decision: E1 branch evidence for `any` and `not` policy descendants — 2026-10-07

Question presented to the owner (paraphrased): the E1 witness rules for `talk`, `perform`,
resolved quest objectives and journal variants each require "separate branch evidence" for
`any` and `not` policy descendants, but no rule defines that evidence, and at least 50 of the
157 pending authored paths sit under such nodes. What evidence credits them?

Owner answer (paraphrased):

> (a) A child of an `any` node is credited when that child itself evaluates true at the
> accepted action, and the result is recorded in the step receipt. This matches how `all`
> children are credited now.
>
> (b) A negated guard is never credited for staying false. A guard that can never fire gets a
> reviewed content disposition (for example an unreachable or always-false guard) in a defined
> form, and the count stays honest.

Accordingly, [E1 policy branch evidence](../system/architecture.md#e1-policy-branch-evidence)
defines the rule once by polarity (the number of `not` ancestors) and the four witness rules
link to it. A PM proposal to credit a negative-polarity node from a recorded refusal in which
it evaluated true was not adopted: the runtime refuses with a bare reason code and records no
refusing policy node, so a refusal cannot name the guard that fired. The disposition form is
the checked-in table `kernel/ts/test/e1_dispositions.json` of `{path, reason, evidence,
review}` rows; the recorder reports those paths separately and never counts them as witnessed.
