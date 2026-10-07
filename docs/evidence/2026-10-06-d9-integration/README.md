# D9 integration proof — 2026-10-06

D9 integrates preserved `7207ae63` with published D8/D11 main `de8b1cb5` in
merge checkpoint `54ecc36d`. Source review and final publication remain pending.

## Release

Current successor is chapter v040/API1.35. The independent
[v040 generator](../../../protocol/fixtures/generate_missing_child_v040.py)
applies the D9 authored delta to frozen published D8 v039. Its canonical answer is
[the v040 fixture](../../../protocol/fixtures/missing_child_v040_hash.json),
with [209 initial IDs](../../../protocol/fixtures/missing_child_v040_ids.json).
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
plan and suppression below API1.35. Actual guard removals fail the source test;
restored compiler checks pass. Kernel typecheck and Credo pass.

**Publication hold:** preserved D9 adds a Bram NPC, but the newer owner real-cast
ruling excludes Old Bram while the D9 plan requires his reactions. PM has raised
the governing conflict with the owner. This provisional209-ID pin is not final.
Full pre-push gate, headless simulator, final browser matrix and independent
review remain pending.
No native device, owner save or deferred UI blur work is part of this proof.

## Authored sound correction

Browser proof found the inherited Bell Read claiming audibility in the Fen.
The governing cartridge clause now explicitly binds authored text to the declared
area. Bell Read, Ring narration, scene and Vesper/Sedge responses no longer claim
Fen/isle sound. This updates the independent v040 pin without changing allocation.

Ponytail self-review: reuse pinned recipe resolution and existing receipt replay;
no adapter, new scheduler or generic sound/relationship framework. Correctness
self-review caught the targetless Bell receipt mismatch, deadline/deer guard
interaction, declaration admission gaps and the unresolved cast conflict.
