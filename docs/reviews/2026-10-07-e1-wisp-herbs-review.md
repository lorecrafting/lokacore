# E1 Wisp ward and infirmary herb route review

Checkpoint: `747d439e1ed9548631824dbdd45eb303b5872845` on `proof/e1-wisp-herbs-paths`; route/test source `2d08b5faf3925a8e0e201b8d237c9f5ad506cc84`.

**APPROVE**, no findings. This approves only the bounded Wisp and herb route proof. Both routes remain unregistered in E1 and do not discharge authored inventory paths.

## Review

- Derived requirements from [E1 exact candidate proof policy](../system/architecture.md#e1-exact-candidate-proof-policy), [S4 Wisp](../system/mechanics.md#s4-all-hours-wisp-b6-selected-contract), [S9 Infirmary Herbs](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract), the [B6 chapter values](../system/cartridge.md#b6-marsh-route-and-tuning), the [B5 stock](../system/cartridge.md#b5-herb-and-bandage-stock), and the evidence lessons.
- Wisp route asserts discovery without answer/ward, explicit acceptance, a stable active occurrence across three bank-valid wrong answers, the 3/3 sitting closure, fresh continuation at 0/3, correct `TIDE` resolution, ward knowledge and unchanged RNG. It then reopens before reaching the exact Aldric ward consumer.
- Herb route starts with the twelve authored fenworts and Wick's twelve bandages, proves exhaustion refusal, then checks four explicit 3-for-3 exchanges with distinct occurrences, one current quest row, literal contribution/axis values `1, 2, 3, 3`, original-item custody and delivery of the fourth exchange at the contribution cap. These answers agree with the installed S4/S9 contracts and cartridge values.
- The captured old suites pass after each stated route mutation; the new focused route fails for the omitted correct Wisp answer and omitted fourth exchange. The red cases are distinct from each other and from the existing E1 case tests.
- All entries in the evidence `SHA256SUMS` verify. Each retained trace source SHA matches the route source commit; recipe and test digests independently match those source files. I replayed all 25 Wisp and 43 herb committed steps from the retained initial states against the frozen v042 artifact, checked the per-step decision/state/RNG/clock, and matched each terminal state and digest.
- The evidence explicitly records `certification: false`, keeps these cases outside recorder registration, and makes no inventory or final-gate claim. It also lists failed-threshold Seek, stale custody/carrying, transaction fault/retry and other routes as out of scope.
- Privacy scan found no local/scratch paths or device/team/certificate identifiers. `-whitespace` applies to the evidence tree.
- Focused verification: `mise exec -- node --test kernel/ts/test/e1_wisp_herbs.test.ts` passed 2/2; `mise exec -- npm run typecheck` passed; Prettier check passed. Retained hash verification passed.
- Ponytail/correctness review: Lean already. The two end-to-end route recipes are bounded assertions over the existing SQLite authority and invariant replay; no new dependency, production abstraction or speculative machinery was added.

E1 remains pending. This route proof does not replace the later source-bound registration/review, complete authored-path witnesses, selected 10,000-sequence proof, final candidate review or E2/E3 browser evidence.
