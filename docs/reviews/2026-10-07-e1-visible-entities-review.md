# E1 visible item and NPC witness review

Source `80a90fe4eafd9c997f7c68b666e92d5914705a6f`; integrated recorder change `13522e41f8e940d10267a7dddf948408e319c3a3`; combined report/hash correction through `da951894`.

**APPROVE.** No findings in this bounded visible-entity witness. The helper credits definitions only on an accepted `move` that changes the body’s room, derives IDs from the resulting `gameView` room entities, inventory and equipment, maps those IDs back to exact candidate references, and deduplicates them. The Book projection itself filters hidden room contents; the test proves the Chandler boots and Sedge appear after entry while the Wisp remains uncredited. In the integrated recorder version, `withQuests` preserves quest paths on both room-changing moves and same-room commands. The combined epilogue test continues to replay five ending-specific conversations without disrupting the existing witnesses.

I independently removed the visible-entity projection from a disposable worktree: the eight prior `e1_cases` tests passed, while the new visible-entity test failed at the expected boots assertion. Restored combined focused selection passed 11/11 (cases, Maud and epilogue tests); TypeScript typecheck and Prettier pass; docs check 834/0/0; both source and evidence diffs are clean.

The combined recorder report is source-bound to `70362baa`, has 18/18 real-SQLite receipts and semantic replays, and remains pending with 273 authored paths open (18 dialogue families, 31 choice families). Main evidence hashes verify 5/5; the full-output manifest and retained verification log contain 38 entries each with no failures. Privacy scan found no private paths or device/signing identifiers. This approves only the bounded visibility witness; it does not certify E1. Final path coverage, candidate pin, risk review and 10,000-sequence simulation remain pending.

Ponytail Review: lean already; the witness reuses `gameView` and the existing recorder path, with no dependency or generalized projection framework. The helper is intentionally scoped to accepted `move` entries, so other command types do not receive speculative visibility credit.
