# D10 developer self-review

Developer review, not independent approval. Governing selection: [D10 PM decision](../decisions/pm-decision-d10-finding-way-2026-10-06.md).

## Scope and result

Reviewed the integrated content/compiler/schema, kernel composition and admission,
SQLite recovery, target resolution, terminal and Book diffs. Candidate v042/API1.37
has 211 independently pinned IDs and 57 rooms; the authoritative pin is in
[cartridge](../system/cartridge.md). Frozen older fixtures remain intact.

Committed body entry records actor-owned visits; entry and accepted Look record
only actually visible local NPCs. Read-only presentation does not create knowledge.
The Map exposes visited rooms and links between visited endpoints, without remote
barrier availability. Where uses current visibility or the actor's saved observation;
Knock uses the actual local Chapel exit and participant. Both recoverable boots
retain distinct exact-ID examination through the existing ambiguous target flow.

## Correctness and failure review

- Portable TS and BEAM row composition enforce identity, prior value and observation
  time. Independent literal fixtures also exercise null rows and stale updates.
- Final knowledge writer grouping preserves existing due-job ownership checks.
  A real drowning/reopen witness caught the initial group-reuse bug; no existing
  save guard was weakened.
- SQLite remains changed-row transactional on the action path. Cold recovery reuses
  existing accepted-receipt replay; a small row-shape check preserves typed corrupt
  refusal for nonfinite JSON before canonical comparison. Corrupt and forged rows
  leave owner file bytes unchanged. Real failed and lost COMMIT outcomes retain
  all prior or all next rows and retry once.
- Current visible NPCs without a prior observation remain available to touch Where.
  Hidden/remote NPCs do not gain current location through names or UI controls.
- Initial source lacked either boot assumed by planning; the selected ambiguity
  outcome therefore adds both authored items, recorded in the PM decision.

## Ponytail review

Removed a duplicate receipt-history replay after its deletion mutant survived:
existing recovery already proved the same provenance. Consolidated the small
knowledge query/record helpers into the permitted mechanic shared module and
removed a target/query import cycle. Look recording stays with the existing Look
rule; proposal integration adds only body-transfer detection and final writer
ordering. No pathfinder, tracking service, migration or dependency was added.
Finite dispatch size allowances cover the two new row kinds; they do not add an
alternate abstraction. Cold-open replay remains linear in accepted history, under
its existing validation and refusal path; this slice adds no background replay.

## Evidence and remaining gates

[Source evidence](../evidence/2026-10-06-d10-source/README.txt) records focused real
SQLite behavior, portable differential, transcript replay, headless simulator and
live mutations with old-focused/new-red/restored-green results. Mutations cover
missing entry writes, hidden observations, writer grouping, TS/BEAM row identity,
unsafe saved JSON and current-visible touch admission. Compiler/loader and
presentation helpers supply their own bounded controls.

The broad authority suite has 24 failures independently reproduced by PM on
published main `8dbd14bb` in the D9, transport, water, Western and Book food fixtures.
Those pre-existing failures are retained as baseline debt, without relaxing save
refusal. Independent source reviews, exact-candidate isolated browser proof and
final full gate remain required. Native mobile and UI fuzz #254 remain paused or
deferred under the existing owner decisions.

## Independent finding F1 fix

The foundation reviewer found that the independent invariant treated explicit null
knowledge as absence, despite both composers correctly refusing it. TS now rejects
null before precondition comparison; BEAM uses an explicit missing sentinel and
rejects nil before validation. Forged-success tests reuse the independent literal
successful rows against the frozen null-row inputs. Both existing focused suites
passed before these tests; both new tests failed on the defect, then passed after
the fix. The BEAM randomized differential plus fixtures passes 14 tests. These
checks and the old/red/green logs are retained in the source evidence directory.
