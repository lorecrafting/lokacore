# D11 Character Choice — independent primary source review

PR: #257. Source reviewed: `73d3d9725589c8f4c77e34a8b3a1d1d9c836cc6e`.
Base: published main `60f64a5b31c0b5c26842caf488c4b3fcb24ee463`.
Verdict: **CHANGES REQUIRED**. Reviewer authored none of the slice.

## Requirements derived before the diff

From [D11 mechanics](../system/mechanics.md#d11-character-choice-selected-contract),
[cartridge](../system/cartridge.md#d11-ancestry-declarations-selected-contract),
[save](../system/save.md#d11-character-choice-recovery),
[Book](../system/book-ui.md#d11-character-choice-interaction), the
[brief](../briefs/chapter-one/d11-character-choice-brief-2026-10-05.md), and
[elapsed ruling](../decisions/owner-decision-d11-prechoice-elapsed-2026-10-06.md):

- Four authored choices atomically commit exact six values, inherited skill and faction once; character identity survives death. No pool, carrying, RNG or spell side effect.
- Ordinary play waits for choice; trusted elapsed and due jobs remain admitted without choosing.
- Saved actor values feed policy and Seek; real Swim/Haggle consume acquired and currently qualified skills. Hill sight preserves physical light and barred Scan semantics.
- Book sends the offered invocation, fences pending saves and keeps confirmed choice across refresh, Continue and death.
- Real SQLite reopen, failed/unknown COMMIT and receipt replay preserve exact creation evidence; corrupt evidence refuses without repair. Successor pin/oracles are independently derived and old fixtures stay frozen.
- Focused regressions must reject the brief's named plausible mutations, including loss of character-owned creation values on death.

Read composition principles and mobile, mechanics, storage, contracts and evidence lessons before the diff.

## Finding

**D11-P1 — blocker — `kernel/ts/test/character_choice.test.ts:118`,
`mobile/authority/local-story/character_choice.test.ts:44`.** No focused test carries a
selected character through player death/corpse recovery and cold reopen. Existing death
fixtures have no selected character. In the throwaway review worktree, a mutation in
`runtime/apply.ts` removed `state.characters` whenever an `entity.create` operation
created the player's death corpse. All **21** focused character/death kernel and
SQLite tests still passed. The resulting bug discards the immutable six values and
ancestry and reopens the picker after death; a no-skill choice also admits another
selection. This misses the brief's explicit body-owned-values-erased-on-death red
control and the reviewer workflow's requirement that the tested core mutation fail.

Add the smallest controlled selected-character death and real SQLite reopen regression,
using the existing fatal/death harness or an ordinary lethal consumer. Assert literal
ancestry/attribute answers, no renewed picker, inherited effects and once-only refusal;
retain exact cold receipt validation. Plant this loss mutation, observe red, restore
and observe green. Reuse existing corpse recovery assertions where they already prove
custody. Production code currently preserves the row; this finding requests the
missing focused contract proof, not a redesign.

## Checks and inspected behavior

- Unmodified character/contract/composition and real SQLite focused tests: **27 passed**.
- Independent stale `stat_compare` definition-start mutant: red at saved PER6 policy.
- Independent `character.select` overwrite-precondition mutant: red at literal portable repeat-refusal answer. Restored source: 27 passed.
- Independent player-death selection-loss mutant: **21 passed**, establishing D11-P1; source restored and diff clean.
- Focused Elixir chapter compiler and character composition: **9 passed**.
- Independent v038 oracle regeneration was byte-identical: API1.33, hash `69fddb2135ff438c7de008a27f7328426c3511db352890498662e819dad5743e`, 199 initial IDs. Compiler test compares the whole artifact to its independent answer. Frozen v036/v037 fixtures unchanged.
- Current chapter cold recovery invokes exact accepted-receipt replay and whole-state comparison; creation skill provenance remains bound to the exact command. Existing transaction fencing preserves confirmed adoption and replay.
- Actual four choices, admission, elapsed, policy/Seek, Swim/Haggle, dark sight/physical light and barred Scan inspected. No chapter-specific capability branch or added dependency found.
- Hosted browser old-head deer failure/fix inspected: exact source head adds the required explicit ancestry selection to both deer journeys; it preserves those journeys' behavior assertions. PM reports hosted code CI and exact fix-head browser green. This review did not rerun the hosted browser or native/device work.
- Contract negatives use controlled malformed inputs; portable composition has independent literal answers in both kernels. The developer's 28-guard schema sweep is recorded in integration evidence; separate save/protocol opinion remains workflow-required.

Ponytail Review: lean already; no complexity finding. Correctness review found no
additional source defect. **Open: D11-P1.** Hosted final-head checks and publication
remain PM-owned after the fix and scoped re-review.
