# M6-A — first live cellar fight

Author evidence for deliberate Attack, alternating timed rounds, Stand and directionless random Flee,
real death/corpse/shrine return, and five finite content-owned rat-credit facts. This is not
independent review approval. Final native and whole-repository results are recorded below; source tests alone do not
establish native behavior.

## Contract and content

Governing clauses: [combat mechanics](../../system/mechanics.md#combat1--first-live-encounter-m6-a),
[protocol](../../system/protocol.md), [cartridge](../../system/cartridge.md),
[save](../../system/save.md), and [Book UI](../../system/book-ui.md#live-combat-response-m6-a).
The [seven-line owner copy decision](../../decisions/owner-decision-m6-a-combat-copy-2026-10-04.md)
is the sole new story-copy approval. The [combat-page decision](../../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md)
supersedes the earlier WIP bottom strip; older `portable/m6a-book-*` logs prove only that earlier
implementation. Later page tests and native evidence govern the final UI.

Sampler 0.0.9 removes both obsolete cellar-door references, its barrier and its key before
live lethality. Other passages and owner prose retain their existing provenance. Its independent
Python canonical/hash oracle agrees with the compiler at
`ee1a72f0b8d681d8521b64be5bb2b35cd1ba9e8699cbff21ddad2ecf92d98867`.
The previous 0.0.8 fixture remains pinned for the frozen corpse foundation tests.

## Distinct runtime and persistence controls

`kernel/ts/test/combat.test.ts` executes frozen A/B/C through actual Attack/elapsed decisions,
accuracy strictness/endpoints, conditional damage draws, shared eight-raw-draw exhaustion,
position skips/wake, admission, cancellation, and production recovery across an hour boundary.
`combat_credit.test.ts` rejects forged room/victim/owner/corpse/loss provenance and completes
all five distinct kills before any quest acceptance, without rewarding the later quest.

`mobile/authority/local-story/combat.test.ts` uses actual SQLite rows and receipts: reopen
between rounds, original receipt replay, fatal credit/corpse atomicity, FULL, failed deferred
COMMIT and lost acknowledgement. Pending results fence input and pulse until reconciliation.
A real player death transfers a worn cloak and a held trunk containing a lantern, preserves
MA7 and the prior search-plan fact, returns the same body to the shrine, then walks south four,
east and down at a fixed clock: MV100 to MV94. A too-heavy recovery requires returning to the
shrine to deposit the trunk before recovering the cloak. The reverse passage is legal too.
A deadline input settles lethal due work before attempting Flee.

The recorded `cartridges/ashmere_sampler/transcripts/combat.jsonl` starts fresh, walks north,
east and down, attacks, processes a due round, and flees up. It replays byte-identically through
the existing terminal trace reader. Runtime assertions use independent literal RNG/HP values;
the transcript is a recorded replay control, not an independent numerical oracle.

## Actual red controls

`runtime-mutants.json` records real source mutations and exit statuses; original sources were
restored. Removing intermediate hydration, due RNG threading, due resource timestamps,
strict accuracy, alternating initiative, death closure, escape cancellation and positive fatal
loss validation each produces a failing new behavioral test. The first round-budget vector
survived because its ninth raw draw also rejected. That failing test design is retained; a new
independently calculated vector has an accepting ninth draw and rejects the per-call-budget
mutant. Restored test logs are retained separately.

The portable helper retained 73 logs under `portable/`: independent composition/precondition
fixtures and actual TypeScript/Elixir encounter, cancellation and resource-time mutants. Old
focused suites remain green where claimed; the new fixtures turn red. A redundant invariant
case was removed because the old suite already rejected that mutation.

The compiler/loader helper's logs and schema sweep results are under `content/`. The shared
original 157-case schema corpus covers all 98 changed required/bound/closed-object guards: 67 mutants
are caught by both validators, and 31 invalid schema-subset mutations are refused during
flattening. No survivors remain. The directionless Flee supersession now has 156 cases and replaces its earlier five schema guards with four (one validator-caught, three subset-rejected), plus a forbidden-direction reintroduction mutant. Semantic content mutants independently exercise ownership,
HP/death settings, local unique credit mapping, bounds, defaults and narration references.

## Author self-review

Ponytail Review found no speculative combat framework, general spawner, new persistence table,
new stream, dependency or size exception. Flee reuses the pure movement sequence; combat prose
uses cartridge Text keys and committed receipt narration. The existing RNG sampler reports its
raw draw count to share the round budget. Resource composition reuses canonical target encoding
without introducing an Elixir module cycle. Correctness review checked fatal ordering, replay,
future cancellation, resource timestamp bounds/monotonicity, exact attribution and stale jobs.

## Owner escape supersession

The [random-Flee decision](../../decisions/owner-decision-m6-a-random-flee-2026-10-04.md)
supersedes earlier directional escape captures and tests. New literal two-exit cases prove
canonical ordering and both destinations under independent seeds; zero/one candidates do not
draw. Composed-policy refusal, locked exits, multiplied fare, hidden/refused directional Move,
and real SQLite destination/RNG replay are checked. Five actual mutants under `random-flee/`
each pass the previous combat suite and fail the new controls. Frozen A/B/C remain unchanged.

Native captures 01–11 predate the final combat-only narration, vertical-action and random-Flee
UI corrections. They establish the real live-fight/death/custody/recovery mechanics only.
An unexpected additional rat kill between initial captures has unknown attribution and is not
credited as controlled proof. The later explicit controlled one-HP save records its initial
rows; actual Attack causes death, shrine return, six-exit recovery and carrying refusal with
production recovery rates enabled. Native MV differs from the fixed-clock MV94 oracle because
real time regenerates movement during the walk. Final UI captures follow after rebuilding.

## Final focused combat actions and validation

The [focused ActionSet decision](../../decisions/owner-decision-m6-a-combat-actions-2026-10-04.md)
filters the existing resolved set after all contributions to Flee, eligible Stand, Look and Scan.
The Book retains its existing Scan touch deferral and shows the other available actions under
the log. Repeat Attack is unavailable because melee rounds proceed automatically. Ordinary
movement, aliases, dialogue choices, item/door verbs, recipes, Wait and posture changes other
than Stand are blocked until closure. The filter is derived again on saved reopen.

`combat_actions.test.ts` checks raw/alias/projected denial, allowed inspection/Stand, pending
choice suppression, and restoration after Flee/death. The SQLite reopen case checks the actual
restored action projection. `actions/` retains two source mutations (missing filter and leaked
choice): previous combat/Flee cases pass, new cases fail. The separate Book Look omission mutant
is retained there too. Sleeping frozen vectors now use explicit valid controlled initial
positions; their numeric/state oracles remain unchanged. Earlier directional-Move mutation
records predate this additional admission layer and are historical proof for that layer only.

The pre-budget-fix `bin/check_all.sh` exited 0, including Mix, contracts/features, cycles, Credo, sizes,
AST, docs, their planted red controls, kernel typecheck/tests, formatting, and mobile typecheck/
tests. `m6a-final-fullcheck.log` is the redacted complete output. A real failure found during the
prior full run—combat read-fault handling suppressing ordinary dialogue fallback—was corrected;
`routing/m6a-readfault-*` and `routing/m6a-routing-recovery-fix-*` retain its controls.

Final native captures 18–24 use the final focused-action Release source fingerprint in
`native/pre-budget-build.json` and `pre-budget-source-SHA256SUMS`. Capture 18 reopens a declared sleeping encounter
with actual committed misses, Stand and Look; 19 follows actual Stand and offers Look plus one
Flee; 20 follows actual Flee to The Drowned Lantern at MV98. Captures 21–22 show the actual rat
Attack offer and dedicated combat page at HP1; 23 shows actual timed death and shrine return at
HP10/MV100/MA7; 24 shows a relaunched World after dismissing the chapter page, with no combat
narration leakage. Captured SQLite rows retain the closed encounter, completed round, corpse,
and custody. The prior controlled route/corpse recovery captures 06–11 remain the native route
proof; the final admission filter adds no movement restriction after combat closes.

Captures 12–17 are intermediate UI evidence before focused admission. Capture 12 was already
World after an encounter ended, despite its historical filename. Capture 13's image caught a
startup frame; its accessibility tree records the controls. Final captures supersede those UI
claims. Existing body-text blur remains visible and is documented under Book UI Text clarity;
this work does not claim to fix it. Accessibility captures establish actual offered labels,
action ordering and transitions, not visual sharpness. The owner simulator and save were never
used. `SHA256SUMS` covers every retained evidence artifact except this index, the checksum manifest and its verification output.

Final correctness review found Flee candidate policies used private counters. The fix threads
the existing command-wide query counter through candidate enumeration; projection keeps a
local read-only counter. A controlled two-exit world with 16,385 true leaves per movement policy
exceeds the frozen 32,768-leaf command limit and faults without payment, movement, closure or
RNG adoption. The counter-reset mutant passes prior Flee tests and fails the new test;
`random-flee/query-budget-*` retains red and restored controls. Final normal pre-push checks
and CI apply to this correction too.

Final code commit `87802ea` was rebuilt after the budget fix. The previous isolated simulator
then stopped unexpectedly; that interrupted launch is not credited. A fresh isolated device
received the final Release and a declared controlled active save. Captures 25–26 show saved
combat and actual Stand; 27 retains an honest stale-page Flee refusal as the next round arrived.
Capture 28 finds the automatically completed fight: the rat is dead and World is clean.
Captures 29–30 start a second actual Attack and immediately use the current directionless
Flee, reaching The Drowned Lantern at MV98 with no combat narration in World. The final
build/code hash is in `native/final-build.json`; no owner device or save was used.

## Review round 1: lawful scheduled departure

M6A-R1 is addressed by separating saved encounter integrity from due-round co-presence.
The NPC may occupy another valid room after its daily schedule runs; player-body presence,
living participants, identity/profile, current job, future due time and unique occupancy
remain checked. The unchanged due round closes an absent-opponent encounter without attacks
or draws. No schema, sampler pin, frozen oracle or combat UI contract changes.

`combat_schedule.test.ts` loads a canonical, hashed controlled cartridge into real file SQLite:
Attack at3550, scheduled departure at3600, lost-COMMIT acknowledgement and reconciliation,
cold reopen before3700, then due completion with no events/resource adjustments/RNG draws.
The original validator fails with `save corrupt`. `r1/` retains that reproduction, three actual
red controls (old same-room requirement, missing valid-room check and missing living-NPC
check), and 23 restored focused tests. Existing corruption cases now cover those last two
boundaries. Author Ponytail/correctness review found no extra framework or producer change.

The original evidence and native fingerprints above remain immutable records of their named
heads; the native run predates this save-validator correction. Review-fix proof uses the actual
SQLite authority. `r1/SHA256SUMS` and its verification output cover the additive fix evidence;
the root manifest continues to verify the original 320 artifacts.
