# D9 integration proof — 2026-10-06

D9 integrates preserved `7207ae63` with published D8/D11 main `de8b1cb5` in
merge checkpoint `54ecc36d`. Independent source review is approved; final publication remains pending.

## Release

Current successor is chapter v040/API1.35. The independent
[v040 generator](../../../protocol/fixtures/generate_missing_child_v040.py)
applies the D9 authored delta to frozen published D8 v039. Its canonical answer is
[the v040 fixture](../../../protocol/fixtures/missing_child_v040_hash.json),
with [208 initial IDs](../../../protocol/fixtures/missing_child_v040_ids.json).
Frozen predecessor fixtures are unchanged. Explicit incompatible-save refusal remains.

## Checks completed

- Kernel typecheck: exit0 after restoring the canonical encoder import needed by
  D9's population deadline pairing beside D8/C5 job delivery.
- Focused kernel D9, Study and current source/hash checks:13 passed, exit0.
- Focused Elixir content compiler checks:18 passed, exit0.
- Original real SQLite D9 plus Book projection checks:4 passed, exit0.
- [Schema sweep](schema-sweep.ts):23 required/bound removals killed, zero survivors.
- [Source schema sweep](schema-subset.exs):6 closed-object/discriminator removals rejected.

The first integrated test run exposed provisional tests selecting the first spawned
hound-role entity or population control: D8 crows also use the generic hound role.
Tests now select the exact `fen_hounds` plan. This preserves the intended regression
and does not change runtime population behavior.

## Applicability and outstanding proof

The compiler emits canonical sorted object keys; the v040 App fixture now serializes
its independent value in that same canonical order. A direct `loadCartridge` caller
can supply the same valid hashed object with a different `populations` insertion
order: inherited `initialPopulation` visits `Object.values` without sorting and
allocates different population IDs. This is not corrected by D9. The v040 fixture
serialization correction establishes the canonical compiled/App path only; it does
not claim object-order independence for arbitrary artifact bytes. PM disposition:
keep outside D9, track separately if a supported production ingress is demonstrated.

Expanded Study real SQLite fault proof now passes both failed-COMMIT and lost-ack
branches at ingress, Take and egress, with same-invocation replay and cold-open at
each committed boundary. The existing fixture's fault injector must reset its
one-shot deferred-constraint insertion before each failed transaction.

[Core red controls](red-controls.py) deliberately break suppression, audible area
and foreign-corpse ownership. Each produced an assertion failure (exit1); restored
source passed (exit0).

**Bell receipt fix:** browser diagnostics narrowed the rejected original receipt to
its omitted target ID. The normal Book recipe sends `target_ids: []`; ordinary
`perform` admission resolves the pinned recipe detail, while `bellSave` had
incorrectly required an explicit detail ID. A real SQLite targetless invocation
reproduced `save_corrupt` before the fix. `7f071e40` resolves the pinned recipe
detail and still refuses any conflicting explicit target. D9 and existing bell
checks:17 passed. The separate browser agent confirmed same-origin recovery of
the original corrupt isolated save without Start over; fresh candidate proof
also passed Bell refresh and the stays/prior cast.

**Exact suppression resume fix:** the expanded SQLite fault case exposed
`inconsistent deer sight receipt` at the exact237600 resume. D9's regular/resume
pair legitimately shares one writer group across intervening same-time jobs.
Cold-load now recognizes only its exact same-plan pair, matching both completed
jobs, their common deadline, unchanged cause/generation and cleared resume
binding. Ordinary receipt replay still validates every operation; deer handoff
guards remain intact. D9 plus existing deer checks:10 passed after the fix.

Compiler/loader checks now refuse a non-Boolean cue fact, non-pack suppression
plan and suppression below API1.35. Seven actual guard removals fail their focused tests;
restored compiler checks pass. Kernel typecheck and Credo pass.

**Cast resolution:** the owner delegated the conflict to PM, who retained the newer
October 5 no-Bram ruling. [Clarification](../../decisions/pm-decision-d9-real-cast-2026-10-06.md)
removes the provisional NPC/dialogues and retains the unattended ferry. The revised
v040/API1.35 independent pin is `f67b09edee64dc0449e35cd129663a12d7ea74b180859c06b55ba10c1150f89f`,
with208 IDs. Frozen earlier fixtures remain unchanged.

**Independent review corrections:** regular-first job ordering now derives the
regular job from its own control transition, instead of the resume clearing op's
already-rotated successor. SQLite suffix203 exercises regular-first; suffix201
retains resume-first. Both failed/lost COMMIT paths reopen at237600. Public S2 and
Maud's cellar controls now use existing explicit labelled dialogue binding so
terminal flavor cannot shadow services. Actual route + SQLite cold reopen passes
for prior and fox, with retained ledger custody. [Review red controls](review-red-controls.py)
restore each defect and observe failure; restored D9/deer checks pass.

Portable suppression has eight independent literal transition answers, including
four invalid successful-write counterfeits, in a new fixture; old fixtures remain
unchanged. Both kernels validate these answers before120 randomized suppression
cases compare composition and independent invariant replay.

Headless simulator:19 tests passed (regression seeds and500 fresh sequences).
Full pre-push gate, final browser matrix and independent review remain pending.
No native device, owner save or deferred UI blur work is part of this proof.

## Authored sound correction

Browser proof found the inherited Bell Read claiming audibility in the Fen.
The governing cartridge clause now explicitly binds authored text to the declared
area. Bell Read, Ring narration, scene and Vesper/Sedge responses no longer claim
Fen/isle sound. This updates the independent v040 pin without changing allocation.

Ponytail self-review: reuse pinned recipe resolution and existing receipt replay;
no adapter, new scheduler or generic sound/relationship framework. Correctness
self-review caught the targetless Bell receipt mismatch, deadline/deer guard
interaction, declaration admission gaps and the resolved cast conflict.

Final nondependent checkpoint checks are retained in [focused.log](focused.log),
[compiler.log](compiler.log), [typecheck.log](typecheck.log) and
[headless-sim.log](headless-sim.log), with explicit exit status for the final focused,
compiler and typecheck commands. All retained logs have SHA-256 verification.

Review-fix checkpoint:40 focused Node checks,15 Elixir source/portable checks and
kernel typecheck pass (exit0); see `review-focused.log`, `review-compiler.log` and
`review-typecheck.log`. `review-red-controls.log` records eight planted defects
(four host/service plus four independent portable module removals) and restored
green runs. Ponytail/correctness self-review: no new engine abstraction, binding
uses existing labelled actions, and the receipt exception still requires exact
same-plan completed jobs; ordinary deer counterfeit guards remain tested.

## Final integrated browser and independent review

Source `5bee6811` is independently approved by the
[primary reviewer](../../reviews/2026-10-06-d9-primary-source-review.md),
[save/protocol reviewer](../../reviews/2026-10-06-d9-save-opinion.md) and
[foundation reviewer](../../reviews/2026-10-06-d9-foundation-opinion.md).
[Final browser evidence](../2026-10-06-d9-final-book/README.txt) certifies all five
terminal pairs on the final pin, both public ledger deliveries, scene/reload
recovery, fox Study closure, passive existing hounds and explicit old-pin refusal.
Earlier failed and interim traces remain separately labelled. Exact suppression
expiry and controlled Study corpse faults are SQLite proof, not browser claims.

Intermittent web-adapter allocation failure remains an E3 finding: one confirmed
S2 result retained payment/custody after reopen but could not recover its detail
narration. No cause or resolution is claimed here. Owner save bytes, native mobile
pause and deferred UI blur remain preserved. Full local/hosted publication gates
are recorded separately on their actual checked heads.
