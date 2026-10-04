# PM ruling: sampler condition-band acceptance repair — 2026-10-03

PM repair of the already approved C1 acceptance, under the owner's ongoing scope
delegation; this is not a new owner prose approval. The actual combined touch walk
found SAMP-BAND-01: the sampler has no authored condition-band table/catalog, so it
cannot demonstrate content-owned band phrases and tones by touch (chapter-one plan
[slice 12](owner-decision-chapter-one-plan-2026-10-02.md#12-c1-touch-the-phone-draws-the-new-gameview)).

Add `world.bands` using the existing engine-default eleven cuts and tones at
`2b4c9d6`, `kernel/ts/src/view.ts:216`: 100/90/80 normal, 70/60/50/40 warning,
30/20/10/0 danger. Retain the default keys except the top key becomes `ready`.
Add eleven `band.<key>` catalog strings copied exactly from the existing legacy
phrases at `mobile/app/book/pages.tsx:16` at that same commit. Full HP must project
`ready`/`normal` and display the existing phrase “is in perfect health,” making
fallback-to-key rendering observable. No new narrative, balance, formula or engine/
presenter code is authorized by this repair.

The [adopted 57 story strings and owner-presented batch](owner-decision-sampler-batch-2026-10-03.md)
stay unchanged. Reusing existing UI labels/default band settings supplies the missing
approved acceptance content; substantive new story prose still follows the
[batch-approval rule](owner-decision-chapter-one-content-2026-10-02.md).
Only sampler `cartridge.json` and `text.json` source files are supplemented; the
other 21 source files and every prior cartridge pin remain unchanged. Independently
rederive only the unreleased sampler artifact/hash, prove missing table/text failures,
and require fresh combined Release Simulator evidence for the new hash.
