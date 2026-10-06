# D2 public Priory books — independent save/protocol opinion

Local branch `chapter-one/d2-priory-books`; reviewed source
`de1ea634fdec61f5e13aa1acc0c3e59fda7137e0`, published ancestor
`ac9b22757a82c4b4c3d60ddf8f94e5c98014bae4`; developer evidence head
`d5c2ea2f0da85f6474f281f10e2145c3f25368d8`.
This reviewer authored none of the source and supplements the primary review.

**Verdict: CHANGES REQUIRED.** D2-S1 remains open; no save implementation defect found.

Requirements derived from the [brief](../briefs/chapter-one/d2-priory-books-brief-2026-10-05.md)
and [save](../system/save.md#d2-book-knowledge-and-read-recovery),
[protocol](../system/protocol.md#d2-held-readable-composition) and
[authoring](../system/cartridge.md#d2-public-priory-and-book-authoring) clauses:

- Validate Read against its original actor, book, custody and exact response;
  later lawful custody changes must reopen. Knowledge must agree with grant history.
- Real SQLite retains all-prior/all-next facts and receipt through COMMIT faults;
  exact retry repeats neither grant nor confirmed detail narration.
- Item-readable metadata fails closed under API1.24/readable@1/topics@1;
  predecessor fixtures stay frozen and successor answers are independently pinned.

## D2-S1 — blocker: readable-only history gate has no retained red control

Location: [exchange-save.ts:16](../../mobile/authority/local-story/exchange-save.ts#L16);
[priory.test.ts:170](../../mobile/authority/local-story/priory.test.ts#L170).
The chapter's existing liquids/services/exchanges already force receipt replay.
Deleting only the new readable-item condition leaves **all 497 existing mobile
suite tests passing, with one existing skip**, including all six D2 SQLite tests.
The [review workflow](../WORKFLOW.md#review-stance) and reviewer mutation rule require
this newly guarded behavior to have a test that fails when it breaks.

Independent controlled SQLite reproduction used frozen `ashmere_items` with its
current explicit container declaration, API1.24, and one readable item plus a
false player Boolean topic; no fuel, vessel, service, patrol or exchange consumer.
After legitimate Take/Read, either (a) replace Read narration with another declared
text key, or (b) replace its prior Take receipt with a lawful Look response and
restore ground custody while retaining the Read grant. Current source refuses both
as `save_corrupt`. Removing line16 opens both corrupted saves. The controlled
probes fail with actual `open`, expected `save_corrupt`; restoring the line passes.

**Required disposition:** retain one minimal readable-only recovery regression
case and demonstrate its line16-removal red control. Reuse existing fixture/SQLite
helpers; no new validator or save machinery is required.

## Independent checks and remaining integration work

- Sixteen focused kernel/contract/Book/SQLite cases and five compiler cases pass;
  contract generation is current. Developer evidence hashes verify.
- Independent v026 regeneration produces the unchanged provisional hash
  `117b27fcb5ff551550c48bcb89c1909565db14a9b063b3bbbe9c4504a8f35749`
  and 121 IDs. Frozen v025 fixtures are unchanged.
- Omitted book grant fails seven focused cases; removing ItemReadable's required
  label fails its malformed-metadata case. Restored recovery/probes pass 8 cases;
  final restored contract/probes pass 4. All mutations and disposable probes removed.
- Ponytail Review: lean existing reach/topic/receipt reuse; no complexity finding.
  Publication and coordinated C3/B9 release re-pin remain outside this local review.

## Developer round-1 disposition — independent recheck pending

D2-S1 is implemented in `827abc72`; combined source after published D5 integration
and independent v027 pins is `de756710ea10322bd36ec339bd1d9abf1850067b`.
[Exact-source checks, controls and integration evidence](../evidence/2026-10-05-d2-priory-books/round-1.md)
retain the fix and its observed red/green controls. This disposition does not
change the independent verdict.

## Scoped fix round 1 — APPROVE

Reviewed corrected source `de756710ea10322bd36ec339bd1d9abf1850067b`
and evidence head `c7139a6797484f7ef77eb48640e7d426ec805d09`.
**Final independent verdict: APPROVE. D2-S1 closed; no open save/protocol findings.**

The retained readable-only test at
[priory.test.ts:330](../../mobile/authority/local-story/priory.test.ts#L330)
uses file-backed SQLite without another history consumer. It first reopens valid
Take/Read, then rejects a schema-valid forged narration key as `save_corrupt` while
preserving file bytes. Independently deleting only
[exchange-save.ts:16](../../mobile/authority/local-story/exchange-save.ts#L16)
makes that exact case fail: actual `open`, expected `save_corrupt`; restoration
passes. A separate disposable controlled probe replaces the historical Take with
a lawful Look receipt and restores ground custody: current source rejects the
subsequent unheld Read history without rewriting the file; the same gate deletion
opens it. Both controls fail together and restore green. No new save machinery is
needed; the one retained test closes the shared guard regression.

D5 integration changes the active chapter/fixture pins without changing the
reviewed save, history, grant-attribution or Game confirmation implementation.
Independent integrated kernel/D2/D5/SQLite checks pass 21 cases, Book/App consumers
pass 7, current compiler/Priory/patrol checks pass 7, and contracts are current.
Restored authority/probe checks pass 8; final isolated controls pass 2.
The independent v027 oracle regenerates the identical hash
`2fda0a7f0a571c080c3d9d3969324a1a4920881ea48adab178684fc9330f94de`
and 127 IDs. Published D5 and provisional D2 v026 fixtures remain byte-identical.
The [round-1 raw evidence](../evidence/2026-10-05-d2-priory-books/round-1.md)
contains the matching red/restored outcomes, full active-check result and integrated
pin result; its hashes independently verify. All reviewer mutations and probes
were removed. Ponytail Review: lean fixture/helper reuse; no complexity finding.

This closes the separate save/protocol opinion only. Primary review and exact-head
hosted CI retain their workflow gates; no browser, native or owner-save proof is
claimed by this recheck.
