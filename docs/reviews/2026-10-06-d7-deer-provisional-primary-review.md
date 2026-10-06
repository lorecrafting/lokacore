# D7 deer provisional primary source review — 2026-10-06

Reviewed local source `3d198c17` against `e9db5bdf` and the approved D7 plan and equal-time amendment. This is a provisional source review; D6 predecessor integration, successor release answers, Book browser proof, full final checks and hosted CI remain later gates. The reviewer authored none of the source.

## Requirements derived before the diff

The [archived population row](../archive/spec/00a-chapter-one-content.md#populations), [D7 mechanics](../system/mechanics.md#d7-bounded-deer-and-delayed-sight-flight-planning-contract), [cartridge](../system/cartridge.md#d7-deer-planning-declarations), [composition](../system/protocol.md#d7-sight-flight-composition-planning-contract), [save](../system/save.md#d7-deer-recovery-planning-contract), [Book](../system/book-ui.md#d7-deer-sight-and-hide-details-planning-contract) and [brief](../briefs/chapter-one/d7-deer-brief-2026-10-05.md) require three original cap-one deer, legal bounded wandering and +300 sight flight, attack before flight, exact death-only corpse/hide custody and +172800 replacement. A surviving same-time round may lend only its matching encounter closure and successor cancellation to sight; every other job keeps its ordered writer group and conflict refusal. Pending, stale, fled and dead states must cold-reopen with typed corruption refusal and exact replay. The engine must retain composition through typed slots, jobs, encounters and custody, with cartridge-owned numbers.

## Verdict: CHANGES REQUIRED

1. **Should-fix — loader accepts a sight plan that its save validator rejects.** `kernel/ts/src/content/cartridge_population.ts:32,43-57` validates a sight declaration without requiring a deer/hide bundle, while `kernel/ts/src/mechanics/population/saved.ts:8-35` requires every member of any sight plan to have deer provenance. In a controlled hash-correct copy of the chapter cartridge, adding a complete `sight` declaration to `fen_hounds` passed `loadCartridge` (`ok: true`) and `newWorld`, but `sightsValid` returned `false` immediately. A cartridge accepted at the trust boundary can thus create a world that cold reopen refuses. Require the matching role pair at compiler and loader admission (or make saved validation support the broader declared contract), and add one controlled invalid-source/loader test.

## Checks and review scope

Focused `kernel/ts` deer tests passed 12/12; Elixir content and portable composition tests passed 14/14. In a throwaway detached checkout, removing the sight generation comparison failed the stale-generation test (11 pass, 1 fail); omitting encounter closure failed the round-first and sight-first controls (9 pass, 3 fail). The throwaway checkout was removed. Source inspection covered plan declarations, paired birth/death, legal transfer, exact equal-time handoff, slot and job guards, save receipt checks, and ordinary Book projection/admission. No other concrete primary finding; the separate save/protocol opinion remains required. Ponytail Review: Lean already. Ship.

The source still carries the published predecessor's release pin, as its evidence states. This verdict does not authorize publication.

## Scoped D7-P1 fix recheck — APPROVE

Reviewed exact clean developer head `103fac5a` only for D7-P1, its compiler/loader tests and direct saved-sight consumer. `lib/loka/content/population.ex` and `kernel/ts/src/content/cartridge_population.ts` now require a deer/hide bundle whenever `sight` is declared. The controlled Fen Hounds source fails compilation, and its hash-correct artifact fails loading; the valid deer content still loads. This matches the deer-only provenance requirement in `mechanics/population/saved.ts`. D7-P1 is closed, with no new finding in the touched path.

Independent focused runs: Elixir content 3/3, kernel deer and wire contracts 15/15. In a throwaway detached checkout at `103fac5a`, removing the loader pair guard made the hash-correct Hounds sight test fail (0/1); removing the compiler pair guard made the invalid-source test fail (2/3 suite), followed by a restored green 3/3 run. The checkout was removed. The developer's additional schema and real-SQLite fault evidence is retained in the provisional evidence folder; this scoped recheck does not independently rerun it. Ponytail Review: Lean already. Ship.

Final D6 carryover, independently derived release pins, Book browser proof, complete final gate and hosted CI remain pending; this local approval is not publication approval.
