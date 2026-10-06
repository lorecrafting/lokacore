# D8 exact crow scavenging planning review — 2026-10-06

Reviewed planning head `d3af934c` against published main `f014aa26`. D6's clean unpublished `3245550d` supplies provisional old-coin evidence only. This is an independent docs-only review; no source, runtime, browser, owner save or native proof was run.

## Requirements checked

Archived chapter-one content calls for four instance crows in Green, Drowned Oak and Oak Branches, bounded replacement/wander, actual shiny-item scavenging and a reachable Oak Branches nest of at most eight items. Published C3 has fixed slots, a two-room wander and death-only replacement; D5 supplies the reciprocal reachable canopy. D8 needs exact custody, adjacent transport, one durable intent/job generation, safe fallback and no player acquisition credit. Cartridge owns numbers and world-specific choices; the engine and generic compiler may validate their shape and references without imposing this chapter's literal population count. D6's final published coin and successor answers still require a fresh pin.

## Verdict: CHANGES REQUIRED for source assignment

1. **Should-fix D8-P1 — successful scavenging permanently removes Green crows from Green.** `docs/system/cartridge.md:1305` and `docs/system/mechanics.md:1492` explicitly leave a completed Green-home crow in Oak Branches, outside its Green/Well Lane pair, and skip its ordinary wander until death. Take the delivered sole coin, return it to Green and drop it twice: each cap-one Green crow can make one delivery, then both remain live outside their pairs. A third Green Drop can never bind a present crow, and death-only replacement never fires. Select a bounded lawful return to the ordinary pair after delivery/release or another explicit policy that keeps Green scavenging live, then align the job/save/Book proof. Do not widen ordinary C3 wander or silently retire a live slot.

2. **Should-fix D8-P2 — world-specific cardinality is assigned to generic compiler/loader validation.** `docs/system/cartridge.md:1311` requires the compiler/loader to enforce “exactly four cap-one plans” and direct capacity eight. If that rule is implemented as a generic source or artifact guard, another valid cartridge with three crows or a different nest capacity is rejected even though the declared bounds and references are sound. Keep four/eight as D8 cartridge values, validate legal plan/container structure and the authored D8 relationship through its declaration, and prove this chapter's chosen totals in controlled tests/simulation. No engine chapter-name check is needed.

The four selected homes, reciprocal corridor, one actual D6 coin allowlist, no fake pelt, same-ID custody, Shoo/Attack release and real nest use have plausible first consumers. The exact D6 publication gate and null successor answers are stated honestly. Ponytail Review: no extra framework or dependency; D8-P2 is the only unnecessary generalized validation pressure. `git diff --check f014aa26 d3af934c` passed. Docs-only review requires no mutation or runtime gate.

## Scoped fix recheck — APPROVE

Reviewed only D8-P1/P2 and their directly affected clauses at `f6d012ee`; the original findings remain above.

1. **D8-P1 closed.** `docs/system/cartridge.md:1305`, `docs/system/mechanics.md:1492-1494` and `docs/system/protocol.md:1131-1135` now require a checked reverse corridor leg every authored 150 units after deposit, fallback or Shoo, ending at the member's home in at most seven legs. The slot remains live, ordinary wander skips transport/return, and it resumes only after home arrival. Attack atomically cancels the due job and pauses return; a surviving encounter close reschedules it, death clears it. Same-time population work skips the member in either job order without merging writer groups. The brief names the repeated same-coin Green Drop after both Green crows deliver, and save/Book cover return, pause and cold reopen. This removes the permanent Green depletion scenario without live retirement or an N-room wander change.
2. **D8-P2 closed.** `docs/system/cartridge.md:1311` now gives compiler/loader legal reference, corridor, plan and container-shape checks while chapter behavior/simulation asserts the selected four live slots, eight direct nest roots and one allowlisted coin. The decision and brief agree; no chapter-wide four/eight engine guard is requested.

Ponytail Review: the one return phase and combat pause are justified by D8-P1; no generic pathfinder, replacement shortcut, extra ledger or framework appears. `git diff --check d3af934c f6d012ee` passed. This is a docs-only scoped review; D6 publication/final re-pin, D8 source implementation, tests and runtime proof remain separate gates.

## Published D6 re-pin recheck — APPROVE

Reviewed the four re-pin documentation changes at `a4f9412a` over the integrated planning head `30a1e43f`; the earlier D8 transport/return approval remains scoped to `f6d012ee`. No new D8 mechanics, protocol, save or Book behavior was introduced. No finding.

D6 [PR #247](https://github.com/lorecrafting/lokacore/pull/247) is merged at `61f4200c`, followed by the published status head `f57f1a8c`. The installed cartridge and frozen v035 fixture agree on version `0.0.35`, API `1.30` and SHA-256 `560e16712f3c04538343e9a3ac767604093656bc527864360ccad6a8ab719581`; the ID fixture has 190 entries and one `item/old_coin`. The actual item source is 10g, directly in Well Bottom. Pool Bottom instead contains the chest with its silver ring. Source room exits verify all seven D8 dry corridor edges reciprocally, plus Well Bottom Up to Well Shaft. The published D6 primary and save opinions close their findings; this recheck does not claim to repeat their runtime proof. Remote main's later `a5678743` changes only Beads JSONL and retains `f57f1a8c` as ancestor.

The decision, cartridge clause and brief now consistently distinguish published D6 predecessor answers from still-null D8 successor source/release/hash/IDs. The decision's mechanics anchor matches the shortened active heading. Ponytail Review: the re-pin adds no source machinery or duplicate policy; the historical pin belongs in the dated brief/decision and governing cartridge clause. `git diff --check 30a1e43f a4f9412a` passed. Docs-only scoped review; D8 source implementation, source review and exact-head CI remain separate gates.
