# D5 deeper Fen — source and publication evidence

Final integrated source: `191ef29e`, retaining checked gameplay source
`b680e4353552f0f1b25ec01785ccfead5c318199` on `chapter-one/d5-deep-fen`.
Published main `1c9b9cf4` was integrated with merge commit `6d2da7fd`;
its changes were tracker/workflow only. Gameplay, release artifact and independent
answers are unchanged from the [APPROVE review](../../reviews/2026-10-05-d5-deep-fen-primary-review.md)
at `550d0027`. The review-only record was incorporated as `191ef29e`, preserving
both new review-index entries. Source publication and browser proof remain pending.
No owner save, preview, native build, simulator or device was opened.

Final independent answer: `ashmere_missing_child@0.0.26`, API1.23,
SHA-256 `b84cd2475e29341d8b4396b228f86b48c236e7eaa07b3daa783cae954da5e9f9`,
117 initial IDs. [Generator](../../../protocol/fixtures/generate_missing_child_d5.py),
[hash](../../../protocol/fixtures/missing_child_d5_hash.json) and
[allocation oracle](../../../protocol/fixtures/missing_child_d5_ids.json) use
Python JSON/SHA-256/UUID, independent of compiler/kernel helpers. Regeneration on
integrated main reproduces both files without a diff; [publication pin check](publication-pins.log)
compares compiled bytes and every actual initial allocation to those answers.
D2/C3/B9 are not published dependencies of D5; their later source integrations must
advance and independently re-pin the then-current release. Frozen earlier fixtures
are untouched.

Governing clauses: [mechanics](../../system/mechanics.md#d5-dry-deep-fen-exploration-selected-contract),
[authoring](../../system/cartridge.md#d5-deep-fen-route-and-details),
[Book](../../system/book-ui.md#d5-deep-fen-detail-pages),
[save](../../system/save.md#d5-route-and-read-recovery),
[brief](../../briefs/chapter-one/d5-deep-fen-brief-2026-10-05.md).

## Observed behavior

[Five behavior tests](../../../kernel/ts/test/deep_fen.test.ts),
[results](focused.log), exit 0:

- The literal fresh canopy/Pool/Hollow/Den/Shallows route traverses every reciprocal
  edge. Every intermediate closes/reopens real SQLite. Pool refuses down; Crown
  Scan projects only adjacent Branches, with no entities or semantic change.
- Actual stone resolution accepts `stone`, `ward`, `ward stone` and `at the ward stone`.
  Book projects exact Read label/ID, retains fixed confirmed detail history across
  reopen, and leaks no inscription to World. Read/Examine preserve all gameplay rows.
- Den movement/stone Read exercise genuine failed deferred-constraint COMMIT and
  lost successful-COMMIT acknowledgement, with reconciliation reads blocked.
  Prior memory stays fenced; retry adopts one receipt. Cold reopen and exact replay
  retain location and one Read narration.
- Controlled fatal input relocates the existing original rat only in the test
  bundle, supplies deterministic lethal attack and starts at night; shipped source
  adds no enemy. Actual Attack/elapsed receipts replay on cold load. Same Wren stays
  separated in Den; zero-inventory shrine travel, ordinary Rejoin, corpse-item Take
  and eligible Ferry Landing rescue succeed. Read preserves Q2 before selection,
  while following/separated, after corpse recovery and after rescue.
- Actual message-held/ground stays custody, ordinary Den Drop/Take, Elspeth turn-in
  and early-bell lost retain fixed no-credit Read. A same-named item substituted
  into the original-message role is refused by projection and execution; original
  message custody remains authoritative.

[Existing authority/Book results](existing-authority.log): **84 tests pass**,
covering `vesper_message`, `wren_escort`, `death`, `light`, `readable_alias_book`,
`book/readable` and `book/notice_board`. They retain closed/nested protected-message
admission, overload/custody, escort receipt validation, typed corruption/unavailable
pin refusal and generic Book detail/Back behavior. No browser interaction is claimed.

## Checks and controls

`bin/check_all.sh`: **exit 0** on checked source ([full log](full-check.log)),
including 348 Elixir tests, TS types/full tests, active 32-seed chapter simulation
and established simulator corpus, docs, boundaries, size and red controls.
Focused `mix test --force` for `content_missing_child_test.exs` and
`content_patrol_test.exs`: **six pass** ([log](compiler.log)); complete independent
answer matches compiler output. [Initial full-check red](initial-full-check-red.log)
was the patrol test's stale 0.0.25 literal, corrected to the provisional release.

[Six planted breaks](behavior-mutants.json), [reproducible script](behavior-mutants.py):
missing Pool→Hollow, false Pool bottom, dark Den and misplaced original message
leave prior focused suites green and fail D5. Semantic Read write fails existing
Read tests, requiring no duplicate generic test. Role substitution survived prior
custody tests, motivating the distinct current-chapter test; removing that identity
guard now fails it. All mutations were restored and restored suites passed.

The older synthetic `look`→fatal helper correctly failed current accepted-history
replay ([retained refusal](synthetic-fatal-refused.log)); final proof uses real
combat. No recovery boundary changed.

PM-approved clarifications precede source: schema-valid `ward_stone` admits player
words `ward stone`; Elspeth remains at Ferry Landing, Green is shrine-route travel.
No schema/parser/NPC relocation. Correctness self-review confirms existing
Oak/Hollow/B6 edges and original NPC/message definitions are preserved; five rooms
have dry footing and no darkness/gates, and the stone has only ordinary readable
fields. No bottom/far/fishing/drift/nest operation is added.

Ponytail Review: **Lean already. Ship.** No new mechanic, writer, dependency,
schema, schedule, item or NPC source. Existing authority/presenter/movement/escort/
Read and test harnesses provide the required behavior.

The independent reviewer approved the actual source, governing clauses and mutation
controls. The publication checks below confirm unchanged integrated pins. Shared overlap: manifest/text, App bundle,
active sim/compiler answer and source-sensitive patrol release literals. No milestone gate
is closed by this source record.

## Publication checks on integrated main

[Focused publication results](publication-focused.log): **89 tests pass**, exit 0,
combining the five D5 tests with the existing authority/Book checks listed above.
[Full publication check](publication-full.log): `bin/check_all.sh` **exit 0**;
active headless simulation remains enabled. Pre-push runs the full check line
again on the exact candidate; its result and PR are reported in the final handoff.

Correctness and Ponytail self-review after integration: no gameplay-source diff
from the independently reviewed commit; no new machinery or weakened validation.
The only record cleanup removes an extra trailing blank line without changing
review content. Publication does not include native, preview or owner-save work.

[Capture/redaction script](capture.py); retained bytes are covered by
[SHA256SUMS](SHA256SUMS) and [verification](SHA256SUMS.verify).
