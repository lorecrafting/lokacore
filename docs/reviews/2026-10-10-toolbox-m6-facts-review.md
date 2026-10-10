# Review: toolbox row W2, entity and pair facts (loka-kgd.53, batch M6)

- Local branch `toolbox/m6-facts`, head `4881dca7baadc482b128dfc306cc49686b0c6199`, base `origin/toolbox/batch-m6` `f3d561e6` (49 files). No PR; the developer's Beads comment on `loka-kgd.53` is the body (it reports `/code-review medium`: 9 findings, 3 fixed). Save contract change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row W2](../MECHANICS-TOOLBOX.md#ranked-toolbox); [archived spec 03 §6](../archive/spec/03-domain-state-persistence.md#6-state-scopes) (StateScope closed at four kinds); [fact@1](../system/mechanics.md#target_resolution1-policy1-fact1) and the [reaction@1 subject table](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts); [save](../system/save.md); [composition](../system/architecture.md#building-mechanics-by-composition).
- Hosted CI on the head: ci `38065857195` and book-e2e `38065857236`, both success.
- Verdict: **CHANGES REQUIRED** (two blockers).

## Must be true (written before the diff)

1. One value per (fact, subject) for entity facts and per (fact, subject, character) for pair facts; an untouched subject reads the default and has no row.
2. `fact_compare` and `fact.adjust` read and write at the subject; nothing reads or writes such a fact through a shared row.
3. No fifth `StateScope` (03 §6); any deviation from the row's "scopes entity and pair" wording is recorded in `docs/system`.
4. Every save that accepted content produces reopens and replays; forged or malformed rows are typed `save_corrupt`, never repaired or deleted; older saves load.
5. Both compilers agree on floors and references; `kernel_api` floor raised together.
6. Chapter 1 and corpus bytes unchanged; no raised size allowance.
7. Capability code names no other mechanic or content piece.

## Proof

- (1, 2) `kernel/ts/test/scoped_facts.test.ts` and `mobile/authority/local-story/scoped_facts.test.ts` pass locally: smith met 2 trust 1, miller met 1 trust 0, stranger default with no row; rows survive cold reopen and replay. Proof of the row met.
- (3) Accepted: `per_subject: true` on a `player` or `instance` fact, stored with the `subject_id` that the fact `MutationTarget` and `ScopedFact` already carry; 03 §6 and `test/loka/core/contracts_test.exs:84` (rerun, it is the cited pin) forbid new kinds. Recorded in `docs/system/mechanics.md` (W2, Shape).
- (4) Refuted for one class of content: finding 1. Forged rows: the mobile test covers the bare row, an unknown subject, another character, an extra field, non-canonical text and an untyped value. Consumed items stay entities (moved to `world.consumed`, `mechanics/food/shared.ts:51`); no delta op removes an entity today, so the known-subject check in `facts_typed` (`fact.ts:219-223`) cannot yet reject a real save.
- (5) Floors 1.47: `world.ts:104`, `cartridge_scoped_facts.ts`, `scoped_facts.ex`; `LeafRefs` twins agree. FACT_SCOPE_UNSUPPORTED is checked only by the loader, as the existing scope check is.
- (6) 43 cartridges compiled with the base and head Elixir compilers: byte-identical. `compiler.ex` has 337 lines under the unchanged `size: allow 338` (claim rerun, holds). `invalid.json`: 44 rows added, none removed.
- (7) Composition record present; `reaction.ts`, `policy.ts` and `fact.ts` name no other mechanic.
- Mutants (focused files): reaction subject check dropped (`reaction.ts:214`) caught; loader `fields.length > 1` to `> 2` caught; `facts-save.ts` canonical-key check dropped caught; Elixir floor `[1, 47]` to `[1, 46]` caught (`mix test --force`). `policy.ts:94` `p.subject && target` to `target` survives but is equivalent (the loader refuses a subjective compare that has no subject field, and `targetOf` ignores the subject on other facts). One survivor that is not equivalent: finding 2.
- Consumers: row 15 is not blocked by the subject rules (the `item_acquired` subject is the holder; reaction `fact.adjust` is row 15's work), but see finding 1 for trust assigns in dialogues. G11 is not blocked (engine code passes the NPC to `value`). W3 works as the row reads (named co-present NPC in `when`, write at the entrant subject). The proof story ("the innkeeper learns from whoever walks past") needs `when` to read the entrant's fact, which W2 leaves out (no target in a reaction `when`), unless both NPCs are named. Question for W3, not a W2 defect.
- `talk` with only a target: the generic `action_key: 'talk'` returns `saved` with a rejected `unsupported_capability` decision and revision 0. The talk action key is the dialogue's key, and no client sends a bare `talk` (`view/action_lists.ts:187` builds per-dialogue actions). This is the existing contract, not a bug; not worth filing.

## Findings

1. **blocker**, `mobile/authority/local-story/dialogue-consequences.ts:88-95` (with `kernel/ts/src/content/cartridge_scoped_facts.ts:14-23,65-70`): save recovery checks a dialogue receipt's `fact_changed` payload as `{type, fact, old, new}`, so a per-subject `fact.assign` (whose event carries `subject_id`) fails its own legitimate receipt. The hand-kept `BOUND` list does not match the choices that recovery re-checks (`dialogue-receipt.ts:241-250` `detailNeeded`): every choice of a riddle dialogue, any choice whose sequence has `skill.acquire`, and every choice of a dialogue whose quest has a `deadline`. Repro (sampler copy, not committed): add `riddle {choice_id: answer}` to `smith_talk` and make `greet` `fact.assign trust 2`. It loads, plays and saves, then a cold reopen gives `save_corrupt` ("invalid committed dialogue answer") and Start over. Same result for `greet: [skill.acquire pick, fact.assign trust 2]`. Controls open: a plain player fact in either place, and a per-subject `fact.adjust` (skipped at `:42`). The deadline case follows the same code path but was not run. Expected fix: compare `subject_id` (the speaker) in `changedEvidence`/`assignmentEvidence` instead of keeping a second hand list, with one reopen test that fails today.
2. **blocker** (a test gap, per the reviewer rules), `kernel/ts/src/mechanics/policy.ts:95`: deleting the guard that makes a target-less subject read false leaves `scoped_facts`, `facts`, `reactions`, `variants`, `dialogue` and `tags` tests green. Content can reach it: the loader accepts `fact_compare {fact: trust, subject: "target"}` in a reaction `when`. With that rule in the sampler, the guarded head gives the apple normally, and the mutant faults the give with `evaluator_error`. One assertion pins it.
3. nit, `kernel/ts/src/content/cartridge_scoped_facts.ts:59-63`: `subject: "target"` is accepted where no policy has a target (a reaction `when`, quest, barrier or skill qualification), where it always reads false. This is documented in mechanics.md, but the loader refusing it would turn an authored never-true gate into a diagnostic.

## Open items (agreed, not findings)

- A future despawn or entity-removal row must pin the known-subject check (`fact.ts:219-223`, `facts-save.ts`) first; `proposal_adopt.ts:28` checks only `typedFact`, so an unknown subject would commit and then refuse at reopen.
- `Loka.Content.Floors` exists to keep `compiler.ex` within its allowance; it is 10 lines with one call site, and is acceptable.
