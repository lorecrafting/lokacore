# Owner decision: forward development before release, 2026-10-05

Owner direction, verbatim:

> also since we are in rapid development, any old fixtures and old things we can get rid of whehther its docs, tests, etc. We dont need to have backward compatibility, lets have a posture of forward development and we can afford to break things if it means no backward compatibility until we set a ground zero, probably at release

Until the release baseline is declared, the current contract is the target. A change may replace
or delete fixtures, tests, docs, schema shapes, development release pins and compatibility code
whose only purpose is to preserve an obsolete development contract. Amend `docs/system` and
`protocol` together with the implementation, and independently derive literal expected answers
for the new contract. Do not keep versioned alternatives solely to satisfy old development data.

Keep tests and fixtures that detect plausible bugs in current behavior, including trust-boundary
validation, deterministic kernel semantics, current-build save/reopen/retry and explicit release-pin
refusal. A saved game must never be silently deleted, migrated, or retargeted. A changed current
release may require the player to confirm **Start over**. Record intentional removed pins in the PR
so reviewers can distinguish obsolete coverage from a missing regression check.

This supersedes the frozen-fixture preservation clause of the
[earlier pre-production decision](owner-decision-preproduction-compatibility-2026-10-04.md).
