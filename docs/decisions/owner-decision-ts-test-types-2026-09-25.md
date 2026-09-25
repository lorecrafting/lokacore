# Owner decision: type-check the TypeScript tests — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

After the PR #21 review found that `kernel/ts/test/` is not type-checked (three errors, one
cause), the PM asked:

> The TypeScript test files aren't type-checked today. The reviewer tried it and found 3 small errors, all one cause and harmless now. Fixing it means adding `@types/node`, a free, standard dev-only package that tells TypeScript what Node's built-ins look like. It never ships in the app. OK to add it and turn on type-checking for tests before R4?

Options offered: "Yes, add it now (Recommended)" — a small separate PR with a test config,
the dev package, a one-line fix and a CI step; or "Later, in R5". The owner chose:

> Yes, add it now (Recommended)
