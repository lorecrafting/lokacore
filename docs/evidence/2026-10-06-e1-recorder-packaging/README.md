# E1 bounded recorder checkpoint — certification pending

The active [E1 proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy)
was amended before this recorder in `7dbc0ed1`. The candidate's content/API/counts
remain in the [bundled chapter pin](../../system/cartridge.md#current-bundled-chapter).
This extends the [reviewed runner packaging](../2026-10-06-e1-runner-packaging/README.md).

## Current source and checks

- Source implementation: `b4a602b8`.
- Published main `5102a9500179a8d9ce633e69c1ed13df73115af7` merged locally at
  `5004a68a8567359d31fd914761c109a8d45e0632`, tree
  `4665462959bcc417834cc07fa9c784952dc241d5`.
- Self-review correction `e19712af07b1df8f78c38be4b36dee20ba1ab821`, tree
  `78369ff7f5c62d3d637cc7096f48e2b99c88d663`: retain controlled host clock,
  preserve the deterministic host ID counter across cold reopen, and assert
  the literal 720 hourly boundaries.
- `bin/check_all.sh` on clean `e19712af`: exit 0, 150.123 seconds;
  [redacted complete output](full-gate.log).
- `mise exec -- node --test --test-reporter=dot kernel/ts/test/e1.test.ts
  kernel/ts/test/e1_cases.test.ts`: five tests, exit 0, [output](focused.log).
- The existing elapsed-driver suite after extracting its SQLite host:
  18 tests, exit 0, [output](elapsed-helper.log).

No push, PR or certification verdict has been issued. This recorder still needs
independent review and final proof against the corrected, stable published source.

## Nine provisional cases

The clean CLI smoke at `5004a68a` selected the original compiled v042 bytes:
298,815 bytes, artifact SHA256
`1c53bcd86149ee6087a08f15a5cc625873cc840e4a1769b36df89d03ff581115`.
Its check identity is retained in the [unmodified report](provisional-report.json).
The later host-clock/ID correction has not been represented as this earlier run.

`mise exec -- node kernel/ts/test/e1_cases.ts <artifact.json> <new-output-dir>`
exited **2**, with verdict null and explicit gaps: [CLI output](provisional-case-cli.log).
The nine cases and their semantic replays passed. About 221.89 seconds elapsed
between candidate and report file writes; this is an approximate filesystem wall
measurement for the whole nine-case run, not a phone performance measurement.

| Case | Independent literal answers checked |
|---|---|
| rescued/prior | rescued child, stilled fox, prior allegiance; 49 player invocations |
| rescued/fox | rescued child, free fox, fox allegiance; 48 player invocations |
| stays/prior | child stays, stilled fox, prior allegiance; 49 player invocations |
| stays/fox | child stays, free fox, fox allegiance; 48 player invocations |
| lost/prior | lost child, stilled fox, prior allegiance; 37 player invocations |
| thirty days | clock 64800→2656800, 720 committed hourly boundaries, all 12 authored NPC schedule destinations, eight population/provenance caps, 13 pending future jobs, torch 3600→0 and unlit |
| SQLite full | real page-clamped SQLITE_FULL; prior revision preserved, then revision 2/well_lane/clock 64800, two durable receipts |
| failed COMMIT | real deferred foreign-key failure plus unavailable receipt reads; unconfirmed memory preserved, same literal settlement |
| lost acknowledgement | successful COMMIT with lost acknowledgement and unavailable receipt reads; delivery fenced, same literal settlement |

Each ending cold reopens at scene boundaries, refuses implicit epilogue start on
arrival, checks unreached memory before the explicit epilogue, and checks final
memory plus exactly one story-point report after acknowledgment. Each fault case
checks the durable receipt on a second SQLite connection, cold reopen, identical
duplicate replay and changed-intent conflict without a second receipt or state change.

The 30-day case uses a controlled host advance of 51,840,000 ms at authored rate
50, with no sleep or player Wait. The production ClockDriver commits every due
boundary. Existing kernel invariant checks run at each receipt; only touched SQL
rows are captured. The replay executes recorded commands from the exact fresh
state and compares each decision, clock, RNG, state hash and final digest. This is
**semantic replay**; the real storage faults are rerun by the fixed case recipes.

All nine databases and command logs remain retained in the isolated execution
output. Their [original manifest](provisional-case.SHA256SUMS) has all 20 entries
verified by `shasum -a 256 -c SHA256SUMS`: [verification](provisional-case-hashes.verify).
They are provisional, not final-candidate evidence.

## Controlled red and self-review

Deleting replay fault-schedule validation leaves the older four E1 tests green
(exit 0). The new real SQLite case then fails (exit 1, literal `Missing expected
exception`): [red control](missing-fault-control.log). The restored test also
refuses omitted committed commands and an absent terminal record.

Correctness self-review fixed missing host-clock identity and host ID counter
reset on cold reopen. No production authority/kernel mechanic was duplicated:
the recorder uses existing authority/ClockDriver, simulator `checked`, trusted
`stepElapsed`, row address helpers and Book Continue inputs. The existing SQLite
fault adapter was extracted, retaining its operation-based fault injection.
Ponytail Review: no additional dependency, general framework or unused interface;
no remaining cut identified in this bounded implementation.

## Context-clear handoff and next work

Branch: `slice/chapter-one-e1-r9-certification`. Code checkpoint: `e19712af`.
The source branch is clean after this evidence commit. Earlier reviewed runner
head was `068a8033`; this new recorder requires its own independent review.

The report lists 44 uncovered rooms, 7 quests, 45 dialogues, 60 choices and one
scene. All 648 authored obligation paths remain pending detailed reviewed binding;
observing a family or offered choice never closes a path gate. The next bounded
implementation is fixed legal village/fen/Priory routes plus dream, optional quest,
patrol/expedition/reward cases using this host and literal terminal answers.
Estimate: 2–4 hours for the next source/receipt checkpoint, subject to real engine
failures found on those paths; full coverage has not been promised by this checkpoint.

The simulator independently found seed360 on `a111ac41`, then seed2079 on reviewed
PR276 head `2aa67d3f`; PM retains their immutable failure receipts and owns fixes.
The envelope fix head `520a747d` is under review/screening at this handoff. Main and
check identities will advance. Do not use the provisional integration or this smoke
for an E1 verdict. Preserve failed receipts in the final evidence index and rerun
the applicable proofs on the final published candidate. The existing runner
accepts a monolithic simulation only; four seed shards need a reviewed strict
identity/coverage/digest aggregate before they become final proof.

Certification still requires applicable path/beat/consequence receipts, exact
selected 10,000-sequence proof, real SQLite evidence and independent final review.
E2/E3 browser interaction remains separate, native mobile remains paused, UI blur
remains deferred, and the owner's save bytes/refusal behavior have not been touched.
