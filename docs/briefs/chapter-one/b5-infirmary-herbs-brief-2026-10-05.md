# B5 — S9 Infirmary Herbs: adopted developer brief

**Branch:** `chapter-one/b5-infirmary-herbs`.
**Base:** provisional local `main` `340025a0ef5d3644e84ac23634b74dfa6d20d459`,
B3 source installed; chapter `ashmere_missing_child@0.0.18`, API1.16,
independent fixture `protocol/fixtures/missing_child_v018_hash.json`, artifact hash
`fd98910fd5c0508e6a3ee6e3f56ee4b8477cfb539b7a1527e6a67e60059aa94f`.
B3 independent source reviews remain pending at assignment.
B5 release, API, artifact hash, generated IDs, implementation head, PR, review and
check results: null. Source/dependencies re-pinned at assignment.
PM adoption model: Codex Sol medium; implementation: Sol high for the
cross-layer protocol/save contract. This brief is adoption, not implementation proof.

## Goal and governing contract

Reach public Cloister/Infirmary, meet Wick at all hours, harvest real fenwort at
Willow Shade and exchange three for three real bandages and capped S9 Priory gain.
The normative clauses are [mechanics](../../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract),
[authored stock/tuning](../../system/cartridge.md#b5-herb-and-bandage-stock),
[composition](../../system/protocol.md#b5-harvest-and-exchange-composition),
[save/recovery](../../system/save.md#b5-stock-and-repeat-recovery),
[Book](../../system/book-ui.md#b5-herbs-and-wick-details) and the
[PM adoption](../../decisions/pm-decision-b5-infirmary-herbs-2026-10-05.md).
The [public plan](../../MISSING-CHILD-PLAN.md) B5 consumes the finite M17-C subset,
M20-E repeat/exact rewards and installed M15 adjustment. Historical regrowth and
daily repeats are superseded for this consumer; no forced wait or new creation.

Implement the selected finite authored stock with independent definitions/IDs,
derived custody stock, deterministic one-item harvest, explicit accept/reaccept,
occurrence-bound exact multi-item exchange and separate cumulative contribution.
Source values live only in cartridge tuning. B3 contributes a finite-stock design,
not a new issuance seam; B2 provides real faction/binding/receipt checks. First
supply needs no skill, bell, private-study or time gate. All exchanges are optional.
C5/D12 own later bandage use/herbalism and must not promise unfinished controls.

## Composition and implementation boundary

Follow [building mechanics by composition](../../system/architecture.md#building-mechanics-by-composition).
Containment owns conserved transfers and ordinary recovery; a bounded harvest
selects from authored room stock; dialogue owns exact exchange binding and final
carry admission; quest owns fresh occurrence/explicit reacceptance; fact owns
bounded S9/global faction adjustment; authority commits/adopts once; Book projects
confirmed stock, readiness, refusals and journal. Only missing typed invocation,
multi-item exchange and resolved→fresh active occurrence shape are in scope.
Reuse existing command/operation shapes where sufficient; never add a named
fenwort rule, generic barter interpreter, population, item mint or history store.

Likely files: chapter manifest/catalog/items/rooms/Wick/patch/dialogues/S9/facts;
content compiler and TS loader; narrow harvest/exchange admission and rule helpers;
quest lifecycle/bindings, shared carrying query and view; actual command/action/
quest/binding schemas plus generated contracts/fixtures only as required;
local Story store/load/receipt validators and existing Book detail/journal.
B2's active ledger protections remain intact; retain B3 penny reconciliation
when its source has integrated before assignment.
Out: regrowth/jobs, daily eligibility, skill checks, stacks/templates/creation,
animals, healing/bleeding, native builds/devices and owner-preview/save work.

## Independent acceptance literals and red controls

- Controlled eligible IDs A/B/C/D at Willow Shade, actor load11980g/max12000g,
  each herb20g: Harvest selects A, leaves three room-held and yields load12000g.
  The next Harvest refuses too_heavy with no transfer, narration or RNG. Drop A
  in that room makes the same ID available again; Take A consumes the same stock.
  Empty stock refuses; exact replay never acquires a second item.
- With directly held herbs A/B/C/D and Wick-held bandages P/Q/R/S, active S9
  occurrence1, all otherwise eligible: turn-in transfers A/B/C to Wick and
  P/Q/R to actor, retains D/S and resolves1 once. Herbs20g and bandages10g:
  load12000g becomes11970g; an already overloaded12020g becomes11990g and fits.
  In a controlled heavier-reward cartridge (herbs10g/bandages20g), load11970g
  becomes12000g and fits; load11971g refuses with all custody/quest/facts unchanged.
- Two herbs, nested/ground/corpse/foreign herbs, unavailable Wick, missing reward
  custody, forged or duplicate IDs and stale bound items refuse entirely.
  Acceptance/reacceptance requires funded readiness, not historic acquisition.
  Drop/store an accepted herb, cold reopen, retrieve it through real custody and
  finish the same occurrence. Death retains the occurrence and actual items in
  the owned corpse; recovery, Take and turn-in use those same identities.
- Fresh stock permits four explicit optional occurrences without advancing time.
  Starting faction0/contribution0 yields (1,1),(2,2),(3,3),(3,3), each with three
  actual bandages. After unrelated−2 at contribution3, the next exchange leaves
  faction1/contribution3. Starting faction10/contribution0 yields (10,0), so
  saturation cannot consume unawarded allowance. Reaccept cannot reset the cap.
  Duplicate acceptance while active and occurrence1 replay after2 starts cannot
  replace/resolve2 or award anything again. All twelve herbs end Wick-held;
  all twelve bandages retain exact ordinary custody; no fifth funded herb set.
- Drop/store/recover bandages after completion and reopen: no reward refill or
  contribution reset. Give away optional supplies: no replacement or mandatory
  waiting path. Finale remains playable with unaccepted, active or exhausted S9.
  Reopen empty/partial patch, active missing-herb custody, resolved and reaccepted
  states; then invoke the next real consumer. Preserve lawful B2 balance truth
  and B3 exchanges if its source is installed on the assigned base.
- Real failed COMMIT, both uncertain COMMIT outcomes, lost acknowledgment and
  exact receipt replay leave all prior or all next rows. Corrupt contribution,
  occurrence/binding, transfer evidence or current custody produces save_corrupt
  without repair/deletion. Replay historical faction/custody at its own revision.

Apply each realistic mutant to the old focused suite first; add a minimal test
only if that layer misses its distinct break. Plant omitted outgoing transfer,
wrong selected ID, omitted final carry check, cap based on global faction,
contribution reset on reaccept, and old-occurrence acceptance. Observe focused
behavioral red failures and retain schema guard/mutant sweep for changed schemas.
Expected answers are literal, independent of implementation; no source-text tests.

## Checks, review and stop

Read [mechanics](../../lessons/mechanics.md), [contracts](../../lessons/contracts.md),
[storage](../../lessons/storage.md), [mobile](../../lessons/mobile.md) and
[evidence](../../lessons/evidence.md) lessons before touching those areas.
Run focused compiler/loader/harvest/exchange/repeat/carry/Book/real SQLite checks,
applicable schema mutant sweep and `mise exec -- bin/check_all.sh` once at handoff.
Retain exit status/failing lines, not bulk logs. Ponytail Review and actual-diff
correctness review precede fresh independent Sol review plus required separate
protocol/save opinion; Astra if proposal/foundation changes. Browser interaction
proof belongs to a later authorized slice; no native or SQLite-equivalence claim.

Stop for an unreachable initial patch/Wick, required path stranded by finite
supply, nonrecoverable actual possessions, new creation/respawn machinery, an
unplanned foundation/proposal contract, contradictory governing specs, or a
review footprint exceeding a complete player outcome. PM settles policy; do not
invent production pins, passing checks or an installed B3 creation seam.

Implementation/check disposition: [local draft PR](b5-infirmary-herbs-local-pr-2026-10-05.md).
