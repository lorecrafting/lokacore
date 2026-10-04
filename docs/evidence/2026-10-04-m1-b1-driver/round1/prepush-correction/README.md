# Round-one required-check correction

The first normal round-one push at `8f138d03ca9c2b540622432a5a04959857a87908` exited 1
before publication. The required kernel suite found one existing expectation in
[kernel play](../../../../../kernel/ts/test/play.test.ts): an unterminated trace expected
post-execution `replay differs`, whereas the adopted [trusted replay contract](../../../../system/protocol.md#trusted-local-elapsed-replay)
requires complete framing before any execution. Only that expected refusal is corrected;
the distinct actual elapsed-trace/no-execution regression and eight red controls are unchanged.

The original 55 hashed artifacts and both original verification files remain unchanged, as do
all round-one proof artifacts committed at 8f138d0. This additive current source manifest has
23 entries and includes the newly touched kernel play test. Neither manifest hashes itself or
its verification report. `failed-fullcheck.log` retains the actual failure; `play-restored.log`
records `mise exec -- node --test --test-name-pattern='replaying the transcript twice'
kernel/ts/test/play.test.ts`: exit 0, 1/1 PASS, including repeated complete legacy replay and
all its existing tampering cases. No new test or wording-only mutation control was added.

Ponytail/correctness pass: the one-line expectation follows the adopted preflight timing;
no production code or conformance fixture changes in this correction. The final required full
check is again the normal pre-push hook after this genuine failure; its actual terminal result
will be reported in the PR. No bypass or standalone check_all run.
