# E1 dialogue and choice binding checkpoint

Scope: the current v042 candidate's committed `talk` and `choose` steps. An accepted
`talk` witnesses only a newly opened pending dialogue. An accepted `choose` witnesses
only the selected choice on its pending dialogue continuation. No policy, unselected
choice or other authored definition is credited. E1 remains pending.

The focused real SQLite case opened Elspeth's dialogue after choosing an ancestry,
then selected `accept`. The first committed step witnessed only the dialogue path;
semantic replay after the second step witnessed that path and its exact `accept` choice.
The existing `study_tracks` consequence still witnesses its own transition.

The red control temporarily credited `/choices/accept` on an opened dialogue before
selection. Both pre-existing focused tests passed, and the new dialogue test failed
with that extra path. The mutation was removed. Final focused suite: 8/8 passed;
TypeScript typecheck and documentation links passed. The Ponytail Review found no
unnecessary abstraction or dependency; the actual diff was checked for unrelated
pending continuations, rejected decisions and claim-only replay.

Retained logs and hashes are in this folder. `SHA256SUMS.verify` records successful
verification. This is a bounded binder checkpoint, not final E1 certification or a
10,000-sequence result.
