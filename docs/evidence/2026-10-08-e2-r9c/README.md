# E2 closing proof on `r9c_interactions@0.0.1` (S5)

Governing: [E1 exact candidate proof policy](../../system/e1-certification.md#e1-exact-candidate-proof-policy),
[Commit, fence, reconcile](../../system/save.md#commit-fence-reconcile), E2 brief acceptance 3, 4, 6 and 7
([brief](../../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md)), and
[owner decision E2 plan](../../decisions/owner-decision-e2-plan-2026-10-07.md) (a) and (b). The claim is
**applicable R9C headless interaction evidence** for this synthetic candidate. It is not chapter, browser,
native or product proof.

## 1. Identity

| Field | Value (from [report.json](report.json)) |
|---|---|
| `source_sha` | `7a734d9230d7d09f15fb4087f509c0769f4f5861` (clean S5 commit with `r9c_faults.test.ts` and the C2 comment; the evidence commit follows it) |
| `candidate.id` / `version` | `r9c_interactions` / `0.0.1` |
| `candidate.content_hash` | `7d74fac7f9429475bdd7481fe7bf6b851acae2d0d6eaf1661892705391d17263` |
| `candidate.artifact_sha256` | `6e484e8453dc285a225a6eb31c19d8a39b2bcac7b140db37856191af4093ea6a` |
| `simulation.sequences` | 100 (PM ruling; generator 17, first seed 1) |

## 2. Exit statuses (recorded before this summary)

| Check | Exit | Log |
|---|---|---|
| `mix loka.compile cartridges/r9c_interactions` | 0 | [runner.log](runner.log) |
| `node kernel/ts/test/e1.ts <artifact> <new dir> 100` | **2** (pending) | [runner.log](runner.log) |
| receipts toolchain, compile, foundation-compiler, kernel, sqlite | 0, 0, 0, 0, 0 | [toolchain](toolchain.log), [compile](compile.log), [foundation-compiler](foundation-compiler.log), [kernel](kernel.log), [sqlite](sqlite.log) |
| retained-report assertion (carry C1), no `repro.json`, dot counts | 0, 0, 0 | [report-check.log](report-check.log) |
| `node --test mobile/authority/local-story/r9c_faults.test.ts`, 3 runs | 0, 0, 0 | [faults-3-runs.log](faults-3-runs.log) |
| all `r9c_*` kernel and authority tests (21) | 0 | [r9c-all.log](r9c-all.log) |
| `tsc -p test` (kernel; includes the authority tests) | 0 | [typecheck.log](typecheck.log) |
| planted defect at `78a77cde`: focused kernel, focused authority / r9c / restore | 0, 0 / **1** / 0 | [focused-green](focused-green.log), [red](red.log), [restore](restore.log) |
| fault-row controls rc1, rc2, rc3, rc4, kill-before flip, kill-after flip (each then restore) | **1** each / 0 each | section 3 |
| chapter tests cited in the fault headers, under rc1 and rc2 | **1**, **1** / 0, 0 | [chapter-cites.log](chapter-cites.log) |
| redaction grep (no match expected) | 1 | [redaction-grep.log](redaction-grep.log) |
| `shasum -a 256 -c SHA256SUMS` | 0 | [SHA256SUMS.verify](SHA256SUMS.verify) |

The runner's own capture-time hashes are [runner-SHA256SUMS](runner-SHA256SUMS) and its
[verification](runner-SHA256SUMS.verify). `compile.log` is empty: the Elixir build was already current, and
the receipt's exit status is in `report.json`; `candidate.json` and `compiled.json` (199,820 bytes each,
sha256 `6e484e84…a6ea`, the artifact hash above) are not retained.

## 3. Criteria 3, 4, 6 and 7

**Criterion 3 (runner report).** Recomputed from `report.json`: `status` `pending`,
`certification_verdict` null, `source_artifact.status` `pass`, all five receipts `exit_status` 0,
`simulation.status` `pending` with `sequences` 100 and no `repro.json`, and `pending` gates exactly
PATH_COVERAGE, INDEPENDENT_REVIEW, BROWSER_HUMAN and NATIVE. The runner marks path coverage pending by
design (`kernel/ts/test/e1.ts` `reportOf`), and the recorder is v042-only and refuses r9c bytes
([e1-certification.md](../../system/e1-certification.md)), so the coverage table in section 4 is built by
hand. The `sqlite` receipt runs `mobile/authority/local-story/*.test.ts` at `source_sha`, which contains
`r9c_faults.test.ts`. Its dot reporter does not name files, but the count reconciles: `sqlite.log` has 486
dots = 474 focused authority tests (`focused-green.log`, 473 pass + 1 skipped) + 12 authority `r9c_*` tests
(4 of them in `r9c_faults.test.ts`); `kernel.log` has 915 = 906 + 9 kernel `r9c_*` tests.

**Criterion 6 (real SQLite faults).** `mobile/authority/local-story/r9c_faults.test.ts`; one generic
`row()` checks every fault. Only the unreadable-store and lost-acknowledgement rows fence and answer
`pending` (`:168-172`); SQLITE_FULL rows fail outright and never fence (save.md "Commit, fence, reconcile"),
and failed-COMMIT rows settle inside the call (`:162`), so F2 never shows `pending`. Every row: the store settles on the literal prior or next
revision ("next" is the fault-free run of the same invocation on a byte copy); memory equals the store;
a cold reopen serves the same head, rows, receipts and reports; the same invocation applies once and
then replays with no row change.

| Row | Commit (domains) | Faults, expected settlement | Result |
|---|---|---|---|
| F1 `:232-235` | Wick's exchange: 3 herbs and 3 bandages change holder, 2 facts, quest resolved | SQLITE_FULL write: prior; failed COMMIT (deferred FK, reconciled in the call): prior; failed COMMIT with an unreadable store (fenced): prior; lost acknowledgement: next | green ×3 |
| F2 `:282-284` | final epilogue Continue: memory facts, story point, report, head | failed COMMIT: prior; SIGKILL before COMMIT: prior; SIGKILL after COMMIT: next | green ×3 |
| F3 `:316-317` | paid Rest elapsed settlement: clock, torch fuel, due population jobs | SQLITE_FULL write: prior; lost acknowledgement: next | green ×3 |
| F4 `:334-335` | paid ferry `board_ferry`: body holder, fare player to Sedge, transport | failed COMMIT: prior; lost acknowledgement: next | green ×3 |

Controls (at `7a734d92`, throwaway worktree, each restored by copy and rerun green). A test stops at its
first failing row, so each row is shown red by at least one control:

| Control | Red rows (call site) | Failing assertion |
|---|---|---|
| [rc1](rc1-memory-before-commit.diff): memory adopted before `commit(...)` in `save.ts` | F1 `:232`, F2 `:282`, F3 `:316`, F4 `:334` | `:187` memory differs from the store after a definite failure |
| [rc2](rc2-reconcile-assumes-committed.diff): `reconciled` returns `got ?? r` (committed without a receipt) | F1 `:233`, F2 `:282`, F4 `:334` | `:162` the failed COMMIT replies instead of throwing "nothing was saved" |
| [rc3](rc3-reconcile-never-committed.diff): `reconciled` never finds the receipt | F1 `:235`, F3 `:317`, F4 `:335` (lost ack) | `:187` memory stays prior while the store holds next |
| [rc4](rc4-fence-not-pending.diff): `fenced()` answers not fenced while the outcome is unknown (`delivery.ts`) | F1 `:234`, F3 `:317`, F4 `:335` | `:170` the fenced call throws instead of answering `pending` |
| [kill-before flip](flip-kill-before.diff): expect next | F2 `:283` | `:192` the reopened save is the prior |
| [kill-after flip](flip-kill-after.diff): expect prior | F2 `:284` | `:192` the reopened save is the next |

The chapter tests named in the fault headers were measured under rc1 and rc2
([chapter-cites.log](chapter-cites.log)): `faults.test.ts:213` (both), `:357` and `:387` (rc1),
`bell_receipts.test.ts:10` and `:305` (rc1), `transport.test.ts:210` (both). `finale.test.ts:13` stays green
and is not cited.

**Criterion 4 (planted defect): found.** [mutant.diff](mutant.diff), `kernel/ts/src/mechanics/policy.ts:44-48`,
`escort_state`: a separated escort satisfies `following`. Reachable from legal play: the hound death in
family 4 separates Wren. Focused suites (every kernel and authority test except `r9c_*`, file lists
built with `find`, mirroring the runner globs: [focused-kernel.txt](focused-kernel.txt),
[focused-authority.txt](focused-authority.txt)): kernel 906/906 and authority 473 pass plus 1 skipped, both
exit 0. r9c: exit 1, exactly one failure: `mobile/authority/local-story/r9c_creatures_transport.test.ts:306`
in "family 4: a pack death separates Wren and fails the watch" (`:262`). Wrong result: the
`a_elspeth_rescue` offer is `available: true` while Wren is separated; expected `false`. Invariant: no
`missing_child` rescue credit while the escort is separated. The kernel family 4 tests stay green. Restore
(copy of the saved file, empty `git status --porcelain`, r9c rerun) exit 0. Measured at `78a77cde`;
`7a734d92` differs from it only in `r9c_faults.test.ts` ([heads-diff.log](heads-diff.log)), which is not in
the focused suite and is not the failing scenario.

**Criterion 7 (browser rows).** Named pending; see section 6. Nothing was added to the browser harness.

## 4. Coverage table, keyed by the report's `applicability` obligations

`report.json` lists 980 `uses` over 130 features and 9 feature gates; it lists no dependency obligations.
Rows name the r9c test that executes the obligation (K = `kernel/ts/test/`, A =
`mobile/authority/local-story/`), found from the action keys each test presses. Class rows (definitions,
policies, events, authored paths) are exercised by the families but have no per-path disposition: that is
the PATH_COVERAGE gate, which stays pending.

**Capabilities (36 locked).**

| Capability | Executed by |
|---|---|
| action_recipe, scene, reaction, quest, dialogue | K `r9c_custody_terminal.test.ts:254`; A `r9c_custody_terminal.test.ts:240` (Ring/Silence, epilogue, bell reaction) |
| barrier, containment, commerce, resource, fact, readable, inspectable_detail, knowledge | K `r9c_custody_terminal.test.ts:110`; A `r9c_custody_terminal.test.ts:143` |
| skills | K `r9c_custody_terminal.test.ts:110` (haggle); K `r9c_creatures_transport.test.ts:119` (DEX-9 Bandage) |
| attributes | K `r9c_creatures_transport.test.ts:119` (DEX 9 then 10) |
| combat | K `r9c_creatures_transport.test.ts:91`; A `r9c_creatures_transport.test.ts:178` |
| bleed, death, transport | A `r9c_creatures_transport.test.ts:178` (D1); F4 `r9c_faults.test.ts:324-335` (transport) |
| escort, expedition | A `r9c_creatures_transport.test.ts:262` |
| food, water | A `r9c_creatures_transport.test.ts:348` |
| liquid, light, equipment, service, position, description_variant, calendar | K `r9c_elapsed_jobs.test.ts:172`; A `r9c_elapsed_jobs.test.ts:190` |
| patrol, schedule | K `r9c_elapsed_jobs.test.ts:337`; A `r9c_elapsed_jobs.test.ts:258` |
| population, behavior | K `r9c_elapsed_jobs.test.ts:405` (both deer orders); A `r9c_elapsed_jobs.test.ts:297` (Oak order only; see section 5) |
| movement, policy | every family |

**Commands (47).** 36 executed, 11 pending. Executed: move, take, put, buy, read, where, knock, open, close, choose_ancestry, choose,
continue, talk (dialogue keys), perform (recipe keys) (K custody `:110`, `:254`); fill, drink, pour, wear,
ignite, douse, refuel, rest, stand, use_service, elapsed, run_job (jobs settled inside elapsed) (K elapsed
`:172`, `:337`, `:405`); attack, flee, bandage, use_transport, expedition, harvest, eat, drop,
recover_corpse, shoo (A creatures `:178`, `:262`, `:348`). **Pending, no r9c scenario invokes them:** look,
scan, sell, give, lock, unlock, remove, sit, sleep, close_choice, accept_quest.

**Paired-job completion invariant (S3 acceptance).** Not an E2 row: held by focused tests, which are red
for the `proposal.ts:278-279`, `:260` and `:253` breaks that stay green in every `r9c_*` file
([audit](../../reviews/2026-10-08-e2-gate-fable-audit.md)): `kernel/ts/test/bleed_composition.test.ts`,
`c5_bleed_early_expiry.test.ts`, `job_completion_invariant.test.ts`, `deer.test.ts`, `deer_contracts.test.ts`,
`schedule.test.ts`.

**Class rows.** definition.* (room 26, item 50, npc 15, detail 19, dialogue 26, variant 11, readable 9 and
the rest), policy.* (fact_compare 105, all 61, quest_state 37, others), event.* (fact_changed 18 and four
others) and authored.* (dialogue 157, action_recipe 94, containment 66, scene 51, quest 33, reaction 24 and
the rest): exercised by families 1-7, per-path disposition **pending (PATH_COVERAGE)**.

**Feature gates (9), evidence touching each gate; disposition pending.** STATIC: compile receipt, `source_artifact` pass, K `r9c_interactions.test.ts:19`,
`:54`. TRANSACTION and AUTHORITY: the sqlite receipt, the A `r9c_*` files and criterion 6. DETERMINISM: the
100-sequence simulation (status pending; the 10,000 run is release-candidate work) and the replay checks in
every A file. QUEST, RULES, SCENE, TOPOLOGY, WORLD: the capability rows above.

## 5. New detection versus already caught

- **New (E2):** the Continue-replay receipt skip (`mobile/authority/local-story/invocation.ts:57`) is
  guarded only by A `r9c_custody_terminal.test.ts` (header `:5-6`, family 2 `:238-239`; S2 review M4).
  Carry C4.
- **New (E2, this slice's planted defect):** separated escort counts as following (section 3).
- **Already caught, not new:** S3 planted-defect candidate 2 (payment conserved, liquid source not debited,
  `service/shared.ts:105`) is red in the focused service and liquid tests (S3 review M2). The route-cursor
  retry break is caught by `kernel/ts/test/c6_expedition.test.ts:112` and A `c6_expedition.test.ts:285`
  (S4 review). The crow acquisition credit (`crow/job.ts:103`) is also caught by
  `kernel/ts/test/transcripts.test.ts:24`.
- **Deer equal-time order (carry C3):** both orders only in K `r9c_elapsed_jobs.test.ts:405-435`
  (Willow and Oak passes at `:419`). A `r9c_elapsed_jobs.test.ts:297` covers the Oak order only; it counts
  once, for Oak.
- Unqualified Bandage: covered by K `r9c_creatures_transport.test.ts:119` (DEX 9), not a pending row.

## 6. Named pending rows

- Browser, families 1, 2, 3, 4, 5, 6 and 7: each **pending: "no harness loads a non-bundled artifact"**
  (owner decision (a)).
- Hermes, native SQLite, native lifecycle, accessibility: pending under the mobile pause.
- PATH_COVERAGE, INDEPENDENT_REVIEW, BROWSER_HUMAN, NATIVE: pending in the report.
- The 11 pending commands in section 4.
- Known untested guard: the crow origin guard `kernel/ts/src/mechanics/crow/shared.ts:74-80` is reachable
  only from a forged row (follow-up loka-zfq, not S5 scope).

## 7. Tried (planted-defect search)

| Mutant | Focused exit | r9c exit | Red tests | Disposition |
|---|---|---|---|---|
| `mechanics/policy.ts:44-48` separated satisfies following ([diff](mutant.diff)) | 0 / 0 | 1 | A creatures `:306` only | **qualifies** |
| `crow/job.ts:103` acquisition names `world.body` | not rerun | not rerun | S4 review: also `transcripts.test.ts:24` | ineligible (focused suite catches it) |
| S3 M1 (`runtime/proposal.ts:253`) and R1 (`population/behavior.ts:142`) | not rerun | not rerun | — | not searched: PM ruling, candidate-1 search only if no S4 candidate survived |

Setup note: the first focused run in the throwaway worktree had no Elixir `deps/`, so 20 files that shell
out to `mix loka.compile` failed with "Can't continue due to errors on dependencies". After copying `deps/`
and `mix compile`, the retained run is green. That first log was overwritten and is not retained.

Logs marked "filtered" kept only the summary and failure lines of `node --test`. Retained files are hashed
in [SHA256SUMS](SHA256SUMS) with [verification](SHA256SUMS.verify). Paths are redacted to `<mutant>`,
`<scratch>`, `<worktree>` and `<tmp>`.
