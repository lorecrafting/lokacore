# M6-A first live fight — independent review

PR [#168](https://github.com/lorecrafting/lokacore/pull/168), reviewed head
`53f1d4c7d4d3d054c5024bca43bddd1d6121e679`, base `78dcb34`.
Fresh independent reviewer; authored none of the implementation.

**Verdict: CHANGES REQUIRED.** One open blocker, M6A-R1.

## Requirements derived before reading the diff

Read the governing [mechanics](../system/mechanics.md#combat1--first-live-encounter-m6-a),
[protocol](../system/protocol.md#encounter-and-round-supplements-m6-a),
[cartridge](../system/cartridge.md#first-encounter-authoring-m6-a),
[save](../system/save.md#live-encounter-persistence-m6-a),
[Book UI](../system/book-ui.md#live-combat-response-m6-a),
[frozen first-encounter oracles](../spec/conformance/first-encounter.md), and all four
M6-A owner decisions linked by those clauses before implementation review.

- Deliberate living/standing/present Attack creates one encounter and future job without
  damage or RNG. Alternating opportunities, strict accuracy, conditional damage draws,
  eight shared raw draws, recovery and fatal closure match independent A/B/C answers.
- The proposal retains prefix hydration and one RNG; fatal loss, closure, corpse custody,
  revival and exact first-lethal credit compose atomically. Existing mechanics must produce
  states the save can reopen; replay and unknown COMMIT preserve complete prior/next state.
- Directionless Flee uses canonical legal ordinary movement candidates, shared query budget,
  no draw with one candidate, one fare and cancellation. Final resolved ActionSet restriction
  covers raw commands, aliases and pending choices and derives again on reopen.
- The dedicated page foregrounds the encounter and current typed controls; committed combat
  narration stays outside World through closure, death, Flee and reopen. Ordinary narration
  survives mixed receipts. Seven approved strings, free recovery route and prior pin remain.
- Portable schema/composition/invariant twins agree with independent fixtures. Native claims
  distinguish controlled states, historical captures and final-source interactions.

## M6A-R1 — blocker: lawful scheduled departure makes the save unreopenable

**Location:** `kernel/ts/src/mechanics/combat/saved.ts:38`, reached by
`mobile/authority/local-story/store.ts:132`; interacting producer
`kernel/ts/src/mechanics/schedule/rule.ts:31`.

An authored NPC may have both an attack profile and an ordinary daily schedule. Attack
at logical time 3550 creates the first combat job at 3700. Its daily schedule can move it
out of the encounter room at 3600. The existing schedule rule commits that move while
the encounter remains open until its combat job revalidates presence. The new save validator
rejects this legitimately committed intermediate state because `participantsPresent` is false.
Closing/reopening during that interval therefore returns `save_corrupt` for an intact save.
Unknown-COMMIT reconciliation uses the same loader and is affected too.

Independent executable reproduction used the actual sampler artifact with start3550 and
one added rat schedule entry: hour1 → drowned_lantern. The loader accepted its canonical
artifact/hash. In a fresh real SQLite authority, ordinary north/east/down movement, Attack,
and elapsed3550→3600 all succeeded. A second `openStory` on that committed database returned
`{kind: "save_corrupt"}`. No production source or owner save was changed. The kernel-only
control also confirms `encountersValid` is true after Attack and false after the accepted
scheduled move. This is composition with the existing behavior/schedule consumer, not a
request for a new mechanic.

**Fix:** make legal scheduled departure and encounter persistence agree. Preserve the specified
presence revalidation/no stale attacks and corruption checks without treating an engine-produced
state as corrupt. Add a controlled real SQLite regression covering reopen between departure
and the combat due time, then delivery without damage/draws. Check reconciliation through
the same loader. No broader combat framework is needed.

## Verification performed

- Focused TypeScript runtime, content, contracts, portable composition, SQLite and Book suites:
  41 tests passed before mutation and 41 passed after restoration.
- Focused Elixir combat contracts, encounter/resource composition and content suites:
  12 tests passed.
- Independent red control: removed due-job RNG adoption in `runtime/proposal.ts`; the combat
  suite exited1 with six failures, including frozen A/B/C. Restored exact source afterward.
- Independent red control: omitted committed `combat_lines` from local authority narration;
  the real SQLite routing test exited1. Restored exact source afterward.
- Inspected author schema-sweep and semantic red-control evidence; reviewer did not rerun the
  complete schema mutation sweep. Both validators' independent contract cases ran above.
- Prior0.0.8 fixture is byte-identical to the base sampler fixture. Evidence checksum manifest
  verifies; final native source manifest has zero mismatches against this head, and there is
  no runtime/mobile source change since the recorded `87802ea` native build.
- Inspected final native screenshot/accessibility proof and its declared limits. These are
  author-run Release Simulator interactions, not a new reviewer device run. Earlier controlled
  death/corpse/recovery proof and final Stand/Flee captures retain their stated scope; no owner
  simulator/save was used by this review. Existing text blur remains a documented carry.

Full logs remained outside the repository/context. Temporary source mutations were confined
to the detached review worktree and restored; only this record and its index are committed.
The supplied six-green source-head CI status is PM-verified, not a substitute for the above
independent checks.

## Ponytail and correctness disposition

Ponytail Review: lean already; no additional dependency, persistence table, speculative
combat framework or actionable simplification found. Existing movement, resource, death,
ActionSet and receipt mechanisms are reused. Correctness review traced their real consumers
and found M6A-R1. No numerical oracle was rewritten and no unrelated feature is requested.

## Round 1 scoped fix review — APPROVE

Reviewed exact pushed head `f023eff2957eab64a31d93b2224bb8b9d485f895`, including
`e30dcc9e`, `a4d3cc68`, `ddc4e27b` and the final single-use binding cleanup in `f023eff`.
**M6A-R1 is closed. No findings remain open; final verdict APPROVE.**

Scope was the finding's disposition, changed save contract/validator/tests, and direct
load/reconciliation and due-round consumers. The validator now accepts a living NPC in
another valid room while retaining the player's encounter-room presence, schema/identity,
authored attack profile, unique participation and current pending future job checks.
The unchanged round revalidates presence and closes without attacking an absent NPC.
This admits the lawful intermediate state without permitting dead or non-room NPC custody.

Independently ran 23 focused kernel combat/Flee/ActionSet and real SQLite combat/scheduled-
departure tests: all passed. The new controlled artifact passes the actual loader, schedules
departure at3600 after Attack at3550, recovers a lost COMMIT acknowledgement, cold reopens
before3700 with exact saved state, and completes the due job with unchanged RNG/HP,
no events/resource adjustments, a closed encounter and completed job.

Two actual reviewer mutations in the detached worktree tested the boundaries: restoring
same-room NPC validation fails the departure/reconciliation regression; removing the
valid-NPC-room guard fails the save-corruption regression. Both exit1, sources restored,
and all23 focused tests pass again. Inspected the author's additional dead-NPC red control
and verified the additive fix evidence checksum manifest. Existing player presence and
job/identity checks remain in the actual diff; no broad save-validation bypass was added.

Ponytail Review: lean already; this uses the existing validator and due presence check,
with no extra producer hook or framework. No unrelated scope was reopened. The PM confirmed
six green CI jobs on the exact reviewed source head. This fix's proof is SQLite authority
behavior; no fresh native run is claimed. Only this record and its index are committed.
