# E1 ferry route witness review

Initial source `9e5ea35334f1ad78a3126f39e280387bcece9a24`, initial evidence `cfa894c4`; scoped fix source `385f0b202ae5870eaf0cf0c6a1ab46d12a10da99`, corrected evidence `4bc36d01`.

**Initial source: CHANGES REQUIRED.** E1-TRANSIT-1: the first helper compared the visible title key to `room.${destination.key}.title`, which did not establish the actual destination room. A different room sharing that title could receive false transport credit; the original positive-only route test did not catch this.

**Scoped fix: APPROVE.** The helper now resolves the full authored destination reference through `after.roomIds` and compares that ID with the player's committed container. The added negative oracle changes a controlled post-state to another room with the same display title and requires no witness. With the former title-key comparison the new test fails; the prior nine cases remain green. The live topology trace contains accepted outbound and return ferry receipts, each bound to its exact route and committed destination, and semantic replay preserves both.

Independent checks on the corrected source: focused E1 cases 10/10, TypeScript typecheck, Prettier and `git diff --check` pass; docs check 836/0/0. Main evidence hashes verify 7/7 and the full capture manifest/log verify 38/38. The corrected report is source-bound to `385f0b20`, records 18/18 real-SQLite cases and semantic replays, and remains pending with 271 authored paths open. Privacy scan found no private paths or device/signing identifiers. The prior display-key capture is explicitly marked superseded. Final path coverage, candidate pin and 10,000-sequence simulation remain pending; this review does not certify E1.

Ponytail Review: the fix reuses the existing `roomIds` map and exact transport reference; no new abstraction, dependency or configuration.
