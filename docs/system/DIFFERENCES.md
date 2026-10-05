# Where the code and the spec disagree

For the owner. The system docs follow the code; each row is one disagreement found while
checking them at `87a1246`. Deferred requirements that an owner decision already carries are in
[future.md](future.md), not here.

| # | Spec | Code | Difference |
|---|---|---|---|
| 1 | [03 §14](../archive/spec/03-domain-state-persistence.md) receipt fields | `mobile/authority/local-story/store.ts:23`, `:35` | The receipt has no `origin_authority_id`, `semantic_command_digest`, `result_digest` or `created_at`. A receipt whose response was altered but still validates replays as `saved`; only an invalid shape is caught (ROADMAP: carried to R12). |
| 4 | [10 §32](../archive/spec/10-mobile-commerce-release.md) runs pin save, IR, numeric and RNG versions | `mobile/authority/local-story/authority.ts:145` | The pin stores `numeric_profile: null` and `rng_profile: null`; neither kernel exports a profile version. |
| 5 | [23 §11](../archive/spec/23-accounts-progress-admission.md) "Completion-at-least-once persists despite local rollback/reset" | `mobile/authority/local-story/session.ts:154` | A file SQLite cannot repair (not a database, a corrupt page, a damaged report table or index) is deleted by Start over, its pending reports and trace with it ([save.md](save.md#new-game); index-only damage carried to R12, ROADMAP SM2 row, P4A-2). |
| 8 | [03 §14](../archive/spec/03-domain-state-persistence.md): a pre-command terminal rejection gets a receipt with its revision unchanged | `mobile/authority/local-story/authority.ts:30`, `:167` | `stale_view` is a reply with no receipt, so a retry of that invocation id re-resolves against the current world (PM ruling, ROADMAP P4b). `conflict` likewise writes nothing. |
| 9 | [pre-release-proof](../archive/spec/pre-release-proof.md) "a deliberately blocked west exit … without another room" | `cartridges/lantern_proof/barriers/old_gate.json`, `rooms/landing.json:8` | The landing's west exit leads through `old_gate`, keyed by the lantern, into the existing shelter, so after `carry` it can be unlocked and the map loops (PM ruling 1, flagged; the compiler refuses an unreachable key and a barrier face without its reciprocal). |
| 10 | [00 §4.1](../archive/spec/00-first-cartridge-design.md) far scan from `view` rooms (chapter two, 00 §11), perception policies and darkness | `kernel/ts/src/mechanics/movement/rule.ts` | `sight` (in every GameView exit since c1-doors) sees exactly where a move would pass, adjacent rooms only; no far scan, perception or darkness. |
