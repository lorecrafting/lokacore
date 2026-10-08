# PM decision: E1 controlled refusal dispositions — 2026-10-07

**PM decision, reported to the owner on 2026-10-07.** It extends the owner's
[E1 branch evidence decision](owner-decision-e1-branch-evidence-2026-10-07.md) (b) and does not
change it: a negated guard is still never credited, and a refusal never adds to the witnessed set.

The owner record rejected crediting a guard from a bare refusal, because the runtime refuses
with a reason code and names no refusing policy node. A controlled case supplies the attribution
that a bare refusal lacks. So a negated guard that can fire closes by a reviewed disposition row
whose evidence is a recorder-run controlled refusal case:

- every other admission condition of the talk holds, and only that guard's condition is true;
- the case's final replayed step is the talk invoked with that dialogue's action key, refused
  with that guard's reason code;
- the row adds `refusal: {case, code}`, and the recorder checks the binding of path, case and
  code by machine: the case was recorded, its final step was refused with exactly that code, and
  the refused dialogue is the one the row's path names.

A guard that can never fire still needs an evidenced disposition (for example an unreachable or
always-false guard), as the owner decided. The rule text is
[E1 policy branch evidence](../system/architecture.md#e1-policy-branch-evidence).
