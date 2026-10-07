# E1 dialogue policy witness checkpoint

Source `783faeeb` adds candidate-specific policy witnesses to an accepted
`talk` that opens a pending dialogue. The selected dialogue's root is credited;
under `all`, every required child is credited recursively. The runner does not
infer which child of `any` held or credit a child of `not`. Rejected talks and
offered actions earn no path. Semantic replay recomputes the witnesses from
committed commands and states and requires their explicit receipt paths.

The fixed Elspeth report case used the real SQLite authority and 13 committed
commands. Its retained [trace](case.jsonl) and [summary](summary.json) prove the
exact dialogue, root, active First Lead condition and held fox drawing condition.
The focused suite passed 4/4, TypeScript typecheck and docs links passed. When
the required `all` children were deliberately omitted, the three older focused
tests passed and the new Elspeth report test failed; the mutation was removed.
Ponytail Review found no extra dependency or generalized policy evaluator: the
recursive helper only lists children that a successful `all` necessarily proves.

The logs, trace and summary verify against [SHA256SUMS](SHA256SUMS) and its
[verification](SHA256SUMS.verify). This is a bounded binder checkpoint. Other
dialogue branches, the remaining authored obligations, final 10,000 simulator
sequences and independent E1 certification remain pending.
