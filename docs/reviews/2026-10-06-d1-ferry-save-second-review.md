# D1 ferry/isle — independent save/protocol second opinion

Exact provisional source: `8aa63fa97ab55ebdaff8a84b5c9b077b0e1d38de`.
Retained evidence: `b0767d2debb5fab63545946be855f76d8414a369`.
Independent review; authored none of D1. Verdict: **APPROVE**.
This supplements the primary review.

Requirements derived before source inspection: [mechanics](../system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract), [protocol](../system/protocol.md#d1-ferry-transport-composition), [recovery](../system/save.md#d1-ferry-and-lesson-recovery), [authoring](../system/cartridge.md#d1-ferry-and-isle-declarations), [Book](../system/book-ui.md#d1-ferry-and-sedge-details), and the [brief](../briefs/chapter-one/d1-ferry-isle-brief-2026-10-05.md).

- Paid passage conserves exactly two pennies and moves the commanded body plus only its eligible bound follower atomically; replay never repeats those effects.
- Free return and genuinely owned/nonempty isle-corpse recovery remain available without gear/funds, including the dark Loft route from the Chapel shrine.
- Route/detail/quote/recipient, historical corpse/custody and actor/scope evidence are checked at the accepted revision; forged saves refuse without deletion.
- Sedge's co-located free swim lesson grants once before S27 and survives death/reopen without charging or claiming D6 qualification.
- Real failed and both uncertain COMMIT outcomes keep memory all-prior until confirmation and reopen every legal intermediate state.

## Findings

None within the save/protocol scope. Transport opts into the existing revision-ordered full receipt replay independently of vessels/services/exchanges. Reopen rechecks historical quotes, exact authored endpoints, actor/body/payment/corpse/follower truth and complete decisions; later movement or corpse retrieval does not replace the original admission evidence. Free teaching reuses C1's acquired fact and bound choice owner. No new delta operation or save row was introduced.

## Independent proof

| Check | Result |
| --- | --- |
| Kernel transport, literal wire contracts and real SQLite D1 suite | 14/14 pass; same restored suite passes after mutations. |
| Elixir transport authoring and core contracts | 11/11 pass with `mix test --force`; source short refs and controlled malformed endpoint/payment/action/free-lesson authoring are covered. |
| Additional file-backed receipt forgeries | Fifteen independent cold-open cases return typed `save_corrupt`, with byte-identical altered files: command/row actor; receipt scope, command/invocation ID and revision gap; route version; event actor/cause/correlation/scope/context/destination; payment writer group and extra debit. |
| File-backed COMMIT matrix | All twelve controlled cases pass: paid outbound, free return, owned-corpse recovery and lesson × real known-failed COMMIT, uncertain-not-committed COMMIT and lost committed acknowledgement. Uses the existing deferred SQLite foreign-key fault; actually closes/reopens each connection. Memory remains all-prior until confirmation; exact retry preserves one debit/move/grant and one receipt. |
| Original Wren and corpse recovery | Existing accepted source flow retains the original following Wren on crossing without Q2 credit, leaves separated Wren behind after death, and cold-reopens the actual Chapel→dark Loft corpse recovery with original bag/nested lit torch and learned swim. |
| Transport-only replay guard red control | Remove transport from history activation: isolated transport receipt corruption test fails (`open` instead of `save_corrupt`). Restore: focused suite passes. |
| Corpse-owner red control | Remove exact owner comparison: wrong-owner waiver test fails (accepted instead of rejected). Restore: focused suite passes. |
| Wire mutation sweep | All new required-field, numeric/array-bound and command-discriminator removals are caught by the 63 literal valid/invalid cases. Structural type/closed-property requirements remain enforced by the existing schema subset. |
| Generated contracts/restoration | `bin/contracts.exs --check` passes; production source diff is empty. |

Ponytail Review: lean already. Existing payment, escort, skill, creation and receipt replay owners cover the concrete consumer. No second ledger, transport job, service effect interpreter or persistence framework was added.

## Retained evidence verification

The [handoff](../evidence/2026-10-06-d1-ferry-isle/README.md) is frozen at the evidence head above. Its diff from the reviewed source changes only the brief's status annotation and evidence; production source, schemas, frozen answers and bundled assets are unchanged. All 44 hash entries verify. Its 46-file inventory consists of those 44 hashed files, `SHA256SUMS` and the separate verification output; no missing or extra hash target.

The retained failures match the declared provisional lane: Elixir 349/350 fails only the active chapter's independent-answer comparison; the downstream transcript gate lacks the unpublished transport known-answer hash; the app suite 496 pass/one skip/one fail retains its old chapter-save hash expectation. Source replay, focused behavior, the 36-guard authoring-schema sweep and subsequent generation/type/size/format controls are separately retained. These are publication pin requirements, not green publication-check claims. Final integrated version/API/hash/IDs and browser/native proof remain null.

This approves the exact provisional source behavior and its scoped evidence, not final integrated release/hash/ID pins, hosted CI/publication or browser/native proof. Those remain separate delivery gates.
