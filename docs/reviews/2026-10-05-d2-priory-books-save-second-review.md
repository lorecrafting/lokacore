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
