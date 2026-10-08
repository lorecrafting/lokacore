# E1 recorder integration review

Source checkpoint: `a1322ea00941c7ff0e61f5901fc93cca058530b7` on `slice/chapter-one-e1-r9-certification`. The reviewed delta registers the previously approved optional routes into the E1 recorder/replayer and retains the integration evidence. The topology route was already independently reviewed; its registration and red control are checked here as part of the combined case set.

**APPROVE**, no findings. E1 remains pending.

## Review

- The fixed recorder registers topology, Chandler on-time debt, and both Lantern dream branches. `replayCase` allows exactly those case IDs and binds source/check/policy identity, candidate content and artifact hashes, fresh construction, initial state, clock/RNG/identity, committed decisions, invariant results, state hashes and the terminal digest. The optional route assertions supply literal expected outcomes; the only authored obligation credited remains the separately checked `study_tracks` false-to-true witness.
- Literal optional assertions cover Chandler's delivered state, axis 2, resolved journal and 30 pennies, plus refusal after resolution; the dream paths preserve the unacknowledged state through branch selection and resolve only after the final line, with both branches asserted. The topology route retains its 57-room literal assertions, fare/return and swim/water reopen checks.
- The registration red controls are distinct from the older route-only suites: the retained old optional suite passes when the case allowlist is removed, while the extended suite fails with `unknown E1 case`. The topology registration has the analogous retained route red control. The focused E1 tests also reject changed/truncated traces and incomplete fault schedules.
- All files named in the optional integration `SHA256SUMS` verify. The retained source pin is `de6042ed2cfe44df16ad2896e074a98565d3c6f1`; its check hash independently recomputes to the recorded value. The later `a1322` checkpoint adds the evidence and brief link; the recorder code is unchanged. The optional JSONL traces replay against the pinned v042 artifact: three cases, 37 committed steps. The report names 13 total cases, has zero room/scene gaps, five quest gaps, 42 dialogue gaps and 57 choice gaps, with exactly 647 authored paths still pending. `certification_verdict` remains null and status is pending. The README explicitly says other case traces/databases are not retained and makes no claim of final certification.
- The evidence scan found no local/scratch paths or device, team or certificate identifiers. Captured tool output uses the local-path redaction marker; retained world IDs are deterministic proof inputs.
- Focused verification on this checkpoint: `mise exec -- node --test kernel/ts/test/e1.test.ts kernel/ts/test/e1_cases.test.ts kernel/ts/test/e1_routes.test.ts kernel/ts/test/e1_optional_quests.test.ts` passed 11/11; `mise exec -- npm run typecheck` passed. Retained evidence hash verification passed.
- Ponytail Review: Lean already. Ship. Correctness review found no overclaim or replay/registration defect in scope.

No full final E1 certification is claimed: all 647 authored paths, selected 10,000-sequence proof, final published candidate review and E2/E3 browser evidence remain pending. No source files were edited in this review.
