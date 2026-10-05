# D11 — Saved ancestry and six attributes with actual check consumers

Proposed branch: `chapter1/d11-character-choice`.

## Goal, dependencies and governing clauses

Start a new Missing Child run with four meaningful ancestry choices; save the choice once and use actual attributes/skill qualifications. Re-pin C1 acquisition/qualification/checks, B2 single faction axis, B6 PER eligibility, B4 darkness and D6 swim. Governors: archived00 §2/§4.3 amended attributes clause; owner chapter-content decision **#4 fey+SPI/Priory−2/no spell**; active mechanics attributes/policy/check, cartridge source/fresh world, save Opening/New game and preproduction compatibility. Inspected current real chapter has **no attributes.json**, no ancestry selection and no saved attribute writer; runtime fresh derives immutable attribute starts for definitions that exist. Do not claim an existing character screen.

## Explicit PM recommendation to adopt

Introduce six content-defined starts: **STR10,DEX10,CON10,INT10,SPI10,PER10**; one selected **+1** modifier per ancestry. Keep current HP10/MV100, existing MA specification, currency and carrying ceiling unchanged. Stat gains do not silently alter pool maxima, load or old combat RNG. Place the immutable selected ancestry and its per-character attribute overrides under the character's identity, not body/corpse, so death cannot reset or reroll it.

| Choice | Attribute answer | Other chapter-one effect |
|---|---|---|
| fen-born | PER11; others10 | learned swim; single Priory/Fen axis −2 (Fen +2 intent) |
| road-born | DEX11; others10 | learned haggle; Crown effect deferred because no chapter-one Crown axis |
| hill-folk | CON11; others10 | dark-sight for B4 visibility only; mining deferred |
| fey-touched | SPI11; others10 | Priory/Fen axis −2; no spell word |

The +1 amount, uniform starts and single-axis reconciliation are **proposed PM values**, not recovered owner choices or verified Legend formulas. Validate against C1's adopted qualification units before GO; change the **published content table/oracle** together if its units differ. Use actual B6 PER and D6 swim predicates to demonstrate changed qualification; hill dark-sight changes neither arbitrary hidden knowledge nor swim/door eligibility. D12 haggling immediately consumes road-born's learned skill. Fey SPI is a real policy-readable stat even though magic stays chapter2; do not fabricate a spell consumer.

Selection is a normal initial authority-owned committed choice before movement/other gameplay, with an explicit recommended default only if PM selects one in source; do not silently choose on a timer or browser refresh. New game replacement uses existing confirmation/pin rules. One choice commits ancestry, overrides, learned skill and starting faction atomically. No free later reset or equipment-derived extra writers.

## Composition and scope

Character-creation owner validates selected key and writes immutable creation evidence; attributes owner reads canonical saved overrides with immutable starts fallback only for old-format cartridges that declare no selected overrides; skills/faction/light consume their existing typed semantics. Presenter displays offered choices and emits invocation only. Attributes remain generic content keys; no hardcoded six-stat engine default or derived-stat calculator. Protocol/runtime/host hashing includes the chosen state exactly once, with foundation/differential obligations if new delta semantics are needed.

In scope: chapter ancestry/stat source settings, creation choice and once-only admission, smallest typed character-owned storage/attribute query, compiler/loader/protocol/save/generated contracts, initial Book selection/status display, required actual check consumers and current pin/bundle/oracle. Out: guilds, Crown track, mining/spells, XP/levels/practices, random rolls, stat training, derived HP/MA/MV/carry formulas and native work.

## Acceptance, mutants and UI/save proof

Fresh controlled choice yields exactly the literal six values/skill/faction row above. Independent boundary fixtures show PER10 fails a chosen PER11 gate while fen-born PER11 passes; learned swim/haggle still require their actual current qualification; hill darkness permits sight while a closed barrier remains closed. Fey has SPI11/faction−2 and zero learned spell words. Old untrained rat fixture/RNG and death restoration remain unchanged.

Reopen before choice, after choice, after training/temporary qualification change, death/corpse recovery and new-pin refusal; same invocation replays one initial selection, different second selection refuses without stat/faction/skill changes. Failed/uncertain COMMIT cannot expose partially selected ancestry. Missing/null/malformed selected values or contradictory ancestry evidence gives typed corruption, never fallback to base10 that grants a reroll.

Plant missing override→policy linkage, body-owned values erased on death, double selection or fey spell grant. Browser: select each offered choice on isolated fresh runs, display saved values/known skills and actual qualified/refused consumer, refresh/Continue/death with no renewed picker. Stop for C1 unit conflict, new formula beyond this table, invented Legend percentages or reduction of the planned ancestry scope without a reviewed disposition.

## Shared delivery and proof contract

This is a **provisional, source-unbuilt PM recommendation**, not a specification amendment, source GO, review approval or completed check. Parent PM must adopt its policy and re-pin the actual merged prerequisites before assigning source work. Initial inspected baseline was clean PM `0fbd2847`/chapter v011/API1.10. Revalidated during final planning: clean PM HEAD `f467f75b1e5a68462e61987f078508dafcf97a42` records PR190 merged as `05b0cb6f`, chapter `ashmere_missing_child@0.0.12`/API1.11 with the typed escort/fatal-separation/return contract. This is a provisional baseline only; each future A–D prerequisite still needs its own exact merged-source re-pin. Target main/source SHA, release/API version, content hash, allocation oracle and PR number are **null** until that source exists. The branch below is proposed, not created.

Follow `AGENTS.md`, `docs/WORKFLOW.md` and `docs/system/architecture.md#building-mechanics-by-composition`. Amend the governing active clauses and record the substantive PM selection before code in the same PR. Reuse current primitives; no chapter-name switch in the engine, new general framework or speculative capability. Cartridge owns every world number; preserve frozen old fixtures, derive the new release/hash/IDs independently and retain exact refusal across unavailable pins. Read `docs/lessons/{mechanics,storage,contracts,mobile,evidence}.md` for the touched surfaces. A source/schema change requires applicable compiler/loader negatives, generated-contract checks and the contract-lesson schema mutant sweep.

For each new test name the distinct realistic break, use literal expected values independent of the code, and reuse an existing test if it already kills that mutant. Actually plant the named mutation, observe red, restore and observe green. No source-text or registry-count tests. New state must pass real SQLite cold reopen at **every legal committed intermediate**, genuinely failed COMMIT, uncertain COMMIT in both committed and absent branches, lost acknowledgement and same-invocation replay; malformed new rows/evidence must yield typed `save_corrupt` with in-place Start over, never an untyped exception or repair. Memory adopts only confirmed changed rows plus receipt, preserving structural sharing.

Use `mise exec --` and the existing focused kernel/host/Book/compiler harnesses; finish with the normal `bin/check_all.sh`/pre-push gate once and exact-head shared CI, retaining the headless TypeScript `sim` engine checks. Browser Book interaction and refresh/persistence are distinct from Node/real-SQLite host proof. Browser-first iteration is the owner's newer direction in the complete map; publish that workflow routing before source work. Native Android/iOS build, Hermes/device lifecycle and physical harness rows remain deferred to prelaunch tightening. Do not start previews/devices or touch owner saves during this planning task; later browser proof uses an isolated run once authorized.

Developer self-reviews correctness and runs Ponytail Review before handoff. Each source PR needs a fresh primary reviewer; add the workflow's independent save/protocol opinion when those contracts change, and Astra for proposal/foundation changes. Fixes return to the same developer/reviewer. PM verifies all started checks on the exact final head, merges a record-bearing PR with a merge commit, updates ROADMAP status only, and preserves the Claude/Codex handoff. Scope growth past one reviewable complete player outcome, a frozen-fixture conflict, owner-save/destructive work, paid services, weakened recovery/no-wait rules, or a new architecture/spec conflict returns to PM before implementation.

Planning audit: Ponytail review found no new framework or dependency needed; each added semantic surface has the named first consumer above. Correctness review retained exact identity, no-wait, actual route, safe corpse recovery and new-shape save/admission proof. These are design checks only; **no implementation tests, mutations, browser/native proof or independent source approval were run or claimed by this planning task**.
