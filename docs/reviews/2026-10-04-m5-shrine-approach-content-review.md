# M5 chapel-approach content review — 2026-10-04

PR: [#152](https://github.com/lorecrafting/lokacore/pull/152). Reviewed source: `88a400a3d09a9ce808c4ee75b981a52f7e7b8a09`, against main `d279a4ab6acb871ad246fe21811526e0ac168824`.

**Verdict: CHANGES REQUIRED.** Fresh independent primary reviewer; authored none of the subject. Two documentation findings remain open; no content/runtime correctness finding.

## Requirements derived before the diff

Derived at merged main from [cartridge](../system/cartridge.md), [Book UI](../system/book-ui.md), [mechanics](../system/mechanics.md), [M queue](../NEXT-MECHANICS.md), [M4 contract](../spec/conformance/first-encounter.md), [mechanics delegation](../decisions/owner-decision-autonomous-mechanics-2026-10-03.md), [development replacement](../decisions/owner-decision-sampler-development-look-2026-10-03.md) and its pre-player-release exception. The later [bounded PM decision](../decisions/pm-decision-sampler-shrine-approach-2026-10-04.md) states the adopted adaptations.

- Add exactly the four real prototype rooms and Well Lane's north connection, with an open reciprocal route to and from the nave. The altar remains scenery; no Pray, death, respawn, combat or complete Missing Child claim.
- Preserve all 68 catalog values, existing six-room quest/chapter/scene behavior, numbers, capabilities and the other nineteen cartridge fixtures. Eight additional prototype titles/descriptions use only recorded adaptations.
- Replace the current unreleased sampler in place at 0.0.3, retain historical 0.0.2 proofs honestly, and independently derive artifact/hash and shifted entity-ID literals. Keep app binding/save filename and owner app/save untouched.
- Amend active specifications and record/index the delegated PM policy; use existing validation without duplicate runtime machinery or coverage-only tests.

## Findings

- **M5C-01 — should-fix:** `docs/system/book-ui.md:24` still calls `ashmere_sampler@0.0.2` the current sampler. A reader following the active UI specification targets the old unbundled artifact while this PR's source and cartridge contract select 0.0.3. Remove the duplicated version and link the current cartridge authority, or update it consistently.
- **M5C-02 — should-fix:** `docs/system/owner-rules.md:15` links only the bounded 0.0.2 repair; the new substantive delegated PM content/gate policy has no entry in the active rules index. A future agent consulting that index misses the adopted open chapel route and replacement scope. AGENTS.md requires a new decision record and a line here; add a concise link to the new PM decision.

## Verification

Independently inspected the prototype via structural outline and bounded room ranges, without retaining its private path. Its actual SHA-256 matches the recorded source. Verified all eight titles/descriptions and the precise markup/omitted-branch adaptations; compared all 68 previous catalog values unchanged. Independently canonicalized the fixture to `36403b7659f7cf6c12e72e5effc73d71278b3e830de9eec3a2d04c3b90ebd959`; after normalizing only release version, four rooms, Well Lane's north edge and eight catalog entries, the entire artifact equals the previous fixture. Independently recomputed all twenty IdSource allocations from the frozen numeric profile, domain, nil command and literal ordinals. Other cartridge source/fixture pins are unchanged.

Verified all nine retained evidence checksums and inspected actual compiler/cross-loader, both old quest outcomes, new authority route/Look/return, missing-exit red and restoration logs. Those are developer headless results, not native Simulator proof. PM personally confirmed all six started CI jobs green at the exact reviewed source head. No full checks, native build, owner Simulator or save operations performed by this reviewer.

Independent narrow validation on the actual source passed: compiler KAT/cross-loader three tests; both original real-SQLite quest outcomes; compiled-source authority walk north through all five destinations, offered Look with `looked`, no Pray/Attack/respawn, reciprocal return, and eleven durable receipts. A private controlled probe reused existing authority setup without adding a repository test. Removing only the nave south exit made the existing KAT fail (exit 2, 0/1 passed) and the independently compiled mutant probe fail (exit 1, literal expected `[south]` versus actual `[]`). Restored the source byte-for-byte; KAT, actual source compilation and route probe passed again. The restored compiled artifact matches the independent fixture value/hash. Temporary probe removed; only this record/index are committed.

Ponytail Review: Lean already. Ship. No added machinery or redundant tests.

## Developer response — fix round 1

- **M5C-01:** Book UI now links the current sampler to the canonical cartridge contract instead of duplicating a release-version literal. Applied; pending independent narrow recheck.
- **M5C-02:** The active owner-rules index now links the delegated PM chapel-approach decision. Applied; pending independent narrow recheck.

These documentation fixes preserve the reviewed content and evidence. The source-head
verdict above remains CHANGES REQUIRED until the reviewer verifies both dispositions.

## Cross-vendor source review (PM-supplied verbatim answer)

Reviewed source: `88a400a3d09a9ce808c4ee75b981a52f7e7b8a09`. Requested model:
`gpt-6-sol`; runtime model identity was not exposed. PM recorded exit status 0
(session 78203). Answer SHA-256, independently verified before insertion:
`7cece32c6f492490ff5819928856540088cb10476dd7322b75e60b4c1f838f4d`.
PM-retained private raw transcript SHA-256:
`c11fcd2cba8ad3147efefe7776cfbe867aff630e09f4c901a09f5885091afab2`.
The private transcript and paths are not part of this record. N1 overlaps M5C-01;
the primary source verdict remains unchanged pending its narrow fix recheck.

```text
Verdict: APPROVE WITH NOTES — PR #152 at 88a400a3d09a9ce808c4ee75b981a52f7e7b8a09
Model provenance: gpt-6-sol requested; runtime model identity is not exposed to me.

N1 nit — docs/system/book-ui.md:24: The active Book UI spec calls 0.0.2 the current sampler. A maintainer using it to verify Look would select the old release; this HEAD pins 0.0.3.

Ponytail Review: Lean already. Ship.
```