# Owner decision: R6 S4 scope; the job drain follows the first real job, `real_elapsed` is a carry — 2026-09-30

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No
checker can verify it against the chat.

Question: [R6 S4](../ROADMAP.md#proposed-r6-slices) was planned to make `play_time`
action-driven, reconcile `real_elapsed` once through an idempotent resume input, and drain
due jobs ([07 §10](../spec/07-offline-storypacks-to-mmo.md#10-offline-time),
[10 §31](../spec/10-mobile-commerce-release.md#31-initial-player-run-lifetime-defaults),
[04 §5.4](../spec/04-command-event-effect-protocol.md#54-bounded-causality-and-durable-waiting)).
What lands now?

- A: the due-job drain (the 04 §5.4 explicit-advance due set, `run_job` and its
  authority-internal IdSource tag) lands with the first real job, Bram's schedule in R6P
  P3/P4 (the ROADMAP holds the placement, [slices](../ROADMAP.md#slices); "wait to hour 19
  moves Bram through a durable scheduled command", [00a:689](../spec/00a-chapter-one-content.md)).
  `real_elapsed` time and
  [OFF-08, OFF-09 and OFF-13](../spec/15-acceptance-scenarios.md#b-offline-lifecycle) become
  a ROADMAP carry until a `real_elapsed` cartridge is planned (10 §31 calls it a future
  profile). The `play_time` proof (reading, backgrounding, view and restart never advance
  the clock) folds into S6. Gate R6 reports the carry as deferred, not passed.
- B: build all of it now on a test-only cartridge.

Owner (paraphrased): chose A.

PM reasons for A, against B: no cartridge job-definition kind exists; no rule emits
`job.schedule`; no cartridge declares `real_elapsed`. Building it now would freeze a
cartridge format tag, a manifest time policy and a resume command with no consumer.

[14 §R6](../spec/14-implementation-plan.md#r6--offline-authority-and-save-system)'s build
list is unchanged; the gate review reports the carry.

## Resume-design notes for whoever builds `real_elapsed`

PM notes, not policy. The cartridge declares the clamp/rollback policy
([07 §10](../spec/07-offline-storypacks-to-mmo.md#10-offline-time)); the formula below is only
an example of one. Committed chunks would need the separately tested continuation contract
04 §5.4 requires.

- The wall-clock anchor is committed in the same transaction as the advance.
- Accepted interval = `clamp(now - anchor, 0, cap)`. On rollback accept 0 and leave the
  anchor alone.
- Sample the clock only after the fence/reconcile has settled.
- The resume command id derives from (run, head revision/anchor), never from the sample.
- Resume is an authority-internal command, not a player `wait`.
- A long absence over `due_jobs_per_advance` needs an explicit choice between committed
  chunks and a typed fault.
