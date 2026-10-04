# CI simulator parallelism review

PR #163 — reduce simulator CI time while preserving the deterministic sequence envelope.

Source head reviewed: `20d7d116a4adfb99f421d38450849b1812316249`.
Reviewer: fresh independent Codex agent; authored none of the implementation.

## Requirements derived before reading the diff

Governing sources: [Checks](../CHECKS.md), [acceptance envelope §3](../archive/spec/r1-acceptance-envelope.md#3-corpus-command-mix-and-sampling), and [architecture](../system/architecture.md#two-kernels-one-semantic-contract).

- Each fast CI run retains the fixed regression seeds plus at least 10,000 fresh seeded sequences of 1–64 steps; generator version, seeds, sequence count and length distribution remain reproducible. Local sampling may stay at 500.
- Parallel partitions cover the same contiguous seed range exactly once, including an odd count. A single parent clock determines the fresh range; regression seeds execute first.
- Each step retains canonical byte determinism and invariant checks; the reviewed known-answer fixtures remain authoritative. Aggregate sequence/step counts, length buckets, outcome codes and command/cartridge coverage must preserve serial meaning.
- Worker faults or an absent result fail the run. Invariant failures retain seed, shrink/reproduction and inherited OBS trace behavior. No generator, fixture, or existing kernel red-control relaxation is authorized.

## Verdict

**APPROVE.** No open findings.

## Findings and validation

- `kernel/ts/test/sim_batch.ts:47`: the parent completes regression seeds first, then partitions the fresh range into `ceil(count / 2)` and its remainder. Independent instrumentation confirmed exact, unique seed coverage and regression ordering for 0, 1, 7, 8 and 256 fresh sequences. Every recorded per-seed canonical-step digest and each count, step total, length bucket, outcome set and command/cartridge set matched serial execution. These comparisons supplement the unchanged known-answer fixtures; they do not replace them.
- `kernel/ts/test/sim_batch.ts:34`: worker errors and a clean exit without a result reject; termination runs after success or failure. Independent planted worker crashes and missing messages made the focused test fail.
- `kernel/ts/test/sim_batch.ts:23`: a worker-only planted rule throw on seed 2 rejected with generator 14, seed, command reproducer and shrinking, and wrote the expected `trace.run` and `trace.command` records to the inherited OBS directory. Seed 1 has a drained start and correctly provides the invariant-checking reproducer without a playback.
- `kernel/ts/test/sim.test.ts:78`: seven independent mutations were red: overlapping partition, skipped boundary, dropped length buckets, dropped outcome coverage, dropped command/cartridge coverage, worker crash and missing result. The new odd-partition expectations are literal and include regression contribution.
- Unchanged generator, regression seed file, fixtures, canonical checks and existing kernel red controls inspected. `npm run test:sim --prefix kernel/ts` passes all 18 tests before and after temporary controls. Temporary source edits were restored byte-for-byte; none are committed.
- All six source-head CI checks independently confirmed green: bundle, changes, Elixir, lint, simulator and TypeScript. The simulator job took 85 seconds; this is CI scheduling evidence, not device performance evidence.

## Ponytail review

Lean already. Ship. Two fixed Node workers, one summary type, no dependency or configurable worker framework.

## Publication checks

Normal commit and push hooks are required for this record and index; their result is reported with the publication commit.

