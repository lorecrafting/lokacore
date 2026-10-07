# E1 legal room route author checks

Governing policy: [E1 exact candidate proof](../../system/architecture.md#e1-exact-candidate-proof-policy).
Built from source `dc35dd09` and the frozen `missing_child_v042_hash.json` candidate.
These are author checks of the recipe, not final source-bound certification receipts.
The certification runner must register and execute `topology` against its final clean source.

The fresh real-SQLite authority route visits all 57 literal rooms, returns to Ferry Landing,
learns Swim through Sedge, pays the literal outbound fare of 2 and returns free.
The player's pennies remain 18 and Sedge's remain 2 after both ferry cold reopens.
Cold reopens also join the Swim modal, both underwater saves before Surface, the two adopted
hours before the marsh circuit, and the completed route. Every movement checks its literal
room answer. No adjusted state, candidate edits, player Wait or wall-clock sleep supplies a step.

One distinct regression test covers this composite route and its persisted joins.
A planted wrong first direction (`west` → `north`) was applied to the recipe:

| Command under pinned `mise exec --` | Exit | Retained output |
| --- | --- | --- |
| `node --test kernel/ts/test/e1_cases.test.ts` with mutant | 0 | `old-suite-mutant.log` |
| `node --test kernel/ts/test/e1_routes.test.ts` with mutant | 1 | `red-control.log` |
| Same route test after restoration | 0 | `restored.log` |

The mutant reaches Well Lane where Boathouse is expected. Existing E1 case tests do not
catch this route defect; the new test does. `SHA256SUMS` binds redacted raw bytes;
`SHA256SUMS.verify` is the independent verification output. No real content blocker occurred.

Ponytail self-review: two proof files reuse CaseHost and the ordinary authority; no new host,
route search, mechanic, dependency or generalized fixture system. Correctness self-review:
literal per-move rooms plus the complete literal room set prevent false visit coverage;
fare balances are checked after reopen; every recorded commit uses CaseHost's existing
invariant and digest checks. Optional quest completion remains unclaimed.

Validation: `mise exec -- bin/check_all.sh` exited 0. The final focused route test
also exited 0 after the self-review corrected trusted elapsed input to 144,000 ms
at the candidate rate of 50 and pinned the literal logical clock to 72,000.
