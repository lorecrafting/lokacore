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

## Independent save/protocol second opinion

```text
CHANGES REQUIRED
PR: #257 — D11 Character Choice
Head: 73d3d9725589c8f4c77e34a8b3a1d1d9c836cc6e
Base: 60f64a5b31c0b5c26842caf488c4b3fcb24ee463

D11-SP-01 | blocker | lib/loka/core/compose.ex:118
Scenario: compose the literal character.select fixture against a base containing
characters[character_id] = null. Elixir accepts and replaces the existing null
row; TypeScript returns precondition_failed (kernel/ts/src/foundation/compose.ts:111).
The Elixir nil comparison conflates an absent key with a present malformed row,
violating D11's “only when absent” precondition and portable semantic agreement.
Distinguish absence from a present null value and add the literal refusal case
to both kernels. The new tests cover absent and selected rows, missing this case.
This is a foundation defect; current mobile SQLite recovery rejected null rows.

Checks:
- Read AGENTS.md, WORKFLOW, D11 brief, governing mechanics/save/protocol/Book
  clauses, composition rules, and owner prechoice-elapsed ruling.
- Exact-head source loaded from Git objects without checkout or source edits.
- Focused character choice/contracts tests: 10 passed.
- Real in-memory SQLite: all four choices reopened, replayed once, refused a
  second choice, and refused unavailable release pins without losing the save.
- Eleven malformed/forged row or receipt probes returned typed save_corrupt.
- Genuine deferred-constraint COMMIT failure and lost COMMIT acknowledgement:
  input fenced; absent/committed reconciliation branches passed.
- All four ancestries composed with controlled C5 hound hit, bleed ticks and
  expiry; reopened state retained ancestry and attribute values.
- Independent frozen-C5 oracle reproduction matched v038 artifact and 199 IDs.
  Canonical hash, literal selection delta digest and event fields matched.
- Direct exact-head TS/Elixir composition probes reproduced D11-SP-01.
- Ponytail review: no additional complexity finding.

Limits:
Read-only sandbox prevented file-backed SQLite creation and process-level cold
reopen. Reviewed the file/fault tests and reported evidence; independently ran
SQLite probes in memory with fresh authority instances on the same connection.
No broad gate, native/browser work, full differential run, source edits or
posted comments. Later training and death/corpse-recovery reopen were not
independently executed.
```
Open findings after the second opinion: **D11-P1, D11-SP-01**. Verdict remains **CHANGES REQUIRED**.

## Fix round 1 — scoped re-review

Source reviewed: `1cb0f6fb48df47cc2bfa4901cce9f284f2692419` against the
record-bearing `328e60b5e096a5586b2755da4ca180eb48840e53`.
Verdict: **APPROVE**. **D11-P1 and D11-SP-01 closed; no open findings.**

- **D11-P1:** the new real SQLite test chooses fen-born, uses an ordinary controlled lethal hound encounter and trusted elapsed delivery, confirms shrine return and one death corpse, closes the database connection, opens it anew, and asserts literal ancestry/six attribute values, inherited Swim, Priory/Fen −2, no picker and rejected second choice. The test uses the existing host rather than a test-only production hook. Existing death tests retain corpse custody/recovery proof. Replanted deletion of `state.characters` on the player's death corpse now fails this new test at cold reopen (`save_corrupt`); restoring the source passes.
- **D11-SP-01:** Elixir now checks absence with `Map.fetch` in both committed character rows and the composition overlay. This distinguishes a present null row and also preserves once-only selection within a delta; writer-group conflicts still run first. Both kernels independently assert the shared literal `present_null` refusal fixture. Reinstating the old nil comparison makes the new Elixir null-row test fail; restored source passes.
- Focused scoped tests: **19 TypeScript/SQLite passed** and **2 Elixir passed**. Elixir mutation and restoration used `mix test --force`. Source restored; actual diff contains only the review record/index update.
- Read the modified composer dispatch/overlay writer and the new test's real authority/clock/database callers. No additional correctness or Ponytail complexity finding. No broad review, browser/native rerun or unrelated nits.

The developer reports the full/pre-push gate green. Hosted exact source-head CI
and the independent scoped save/protocol recheck remain PM-owned. This metadata
commit is held locally until the PM authorizes its push after hosted source CI.

## Independent save/protocol fix-round opinion

```text
APPROVE
PR: #257 — scoped D11 fix second opinion
Head: 1cb0f6fb48df47cc2bfa4901cce9f284f2692419
Base: 60f64a5b31c0b5c26842caf488c4b3fcb24ee463

Findings:
None open within scope.

D11-P1 | blocker, resolved | mobile/authority/local-story/character_choice.test.ts:124
Scenario: selected Fen-born dies and creates a corpse; reopened authority
retains ancestry, six literal attributes, inherited Swim and faction −2,
hides the picker, and refuses a different second choice.
The added file-backed test covers close/reopen. Independently executed
its in-memory SQLite variant: green. Character-row-loss mutation: red
(save_corrupt during reopen). Unmodified variant rerun: green.

D11-SP-01 | blocker, resolved | lib/loka/core/compose.ex:116
Scenario: characters[character_id] exists with null.
Elixir now refuses selection, matching TypeScript and the literal fixture.
Exact-head probes in both kernels passed absent, present-null and
already-selected cases. Restoring Elixir’s old nil guard broke the
literal present-null assertion.

Checks:
Read AGENTS.md, D11 review record and governing system clauses.
Inspected scoped diff, fixture, harness, composition/overlay handling,
state adoption, changed-row persistence and receipt recovery callers.
Ponytail review: no complexity finding.

Limits:
Read-only sandbox prevented independent file-backed cold reopen.
SQLite execution used fresh authority instances on one real in-memory
connection; disk close/reopen was inspected in the committed test.
Mix xref was blocked by sandbox restrictions; syntax inspection substituted.
No broad gate, native/browser work, file edits or posted comments.
```
