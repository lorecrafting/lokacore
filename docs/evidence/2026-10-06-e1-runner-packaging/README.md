# E1 runner packaging — author evidence

The [bounded ending, 30-day and real SQLite recorder checkpoint](../2026-10-06-e1-recorder-packaging/README.md)
extends this packaging; certification remains pending.

Implementation begins from published `71c3323dee2d9265e59587957eea3e3c90f544ac`.
The active [proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy)
was amended before code in `cc7854eb`. Candidate version, content hash, API,
definition counts, lock and allocation answers live in the
[bundled chapter pin](../../system/cartridge.md#current-bundled-chapter).

Independent Python stdlib inspection of that fixture's canonical text produced
298,815 normalized artifact bytes and byte digest
`1c53bcd86149ee6087a08f15a5cc625873cc840e4a1769b36df89d03ff581115`.
This is the artifact wrapper's byte digest, distinct from the content hash.
The planning JSON/Markdown omissions remain explicitly identified in
[release scope](../../spec/release-scope.md); neither file drives the runner.

## Implemented packaging

`kernel/ts/test/e1.ts` freezes the exact candidate, invokes existing compiler,
foundation/kernel and real Node SQLite authority tests, and explicitly selects
`[loadedCandidate]` for chapter simulation. A clean committed source identity,
schema/protocol/lock/check/policy/toolchain identities and host platform bind the
report. Output logs are redacted and hashed, with a `SHA256SUMS.verify` result.
An existing output directory is refused to preserve prior evidence.

The bounded policy reuses the loader's ownership walks and PR264 dependency check.
It inventories authored branches, beats, consequences and command obligations.
Suite pass receipts do not prove that every inventoried path executed. Reports keep
the certification verdict null, required content coverage pending and native proof
deferred; failed/refused runs exit 1, an incomplete certification run exits 2.

A simulator repro retains the initial state/hash, clock, RNG, deterministic identity,
ordered commands and their digest, explicit no-host-fault schedule and asserted failure.
Replay uses the existing invariant checker, preserving deliberately malformed command
inputs. Playback alone cannot satisfy it. Replay exits 0 only when that failure is observed
again against the same candidate and source/check/policy identity.

## Controlled checks

The [focused test output](focused.log) records 81 passing E1/loader tests, exit 0,
after restoring each planted mutation. These checks run under `mise exec -- node --test`
against `kernel/ts/test/{e1,cartridge}.test.ts`; the E1 entrypoint is resolved from its
module URL, so the package working directory does not retarget it.

| Planted break | Focused check | Exit / evidence |
|---|---|---|
| Remove the exact content-hash guard | A different loader-valid candidate is admitted | 1, [wrong candidate](wrong-candidate.log) |
| Remove the missing policy disposition guard | Installed narration silently gets no bounded obligation | 1, [unknown applicability](unknown-applicability.log) |
| Omit repro fault schedule validation | An incomplete replay record is accepted | 1, [incomplete repro](missing-repro-faults.log) |
| Omit the ordered-command digest comparison | Edited commands are accepted as the original repro | 1, [changed commands](changed-commands.log) |
| Remove the position/scene implicit fact guard | A hand-built artifact boots without fact | 1, existing [loader control](implicit-fact-dependency.log) |

The implicit dependency control reuses the existing loader test; no duplicate was added.
Each mutation was restored before the next check. Literal expected failures are
`wrong E1 candidate`, `unknown applicability: narration@1`, incomplete-repro refusal,
and the existing `UNDECLARED_CAPABILITY` loader diagnostic. Replay additionally checks
the literal observed failure `threw / Error: planted failure / at 0`.
Raw outputs are covered by [SHA256SUMS](SHA256SUMS), with the independent
[verification output](SHA256SUMS.verify) retained beside it.

## Primary review correction — E1-P1

The primary review found that the top-level path predicate treated the slash inside
a raw DefinitionRef map key as a JSON nesting boundary. This omitted root obligations
for definitions that the loader's `parts()` walk does not inventory. The fix identifies
section children by actual object depth; nested branch/beat/consequence checks are unchanged.

The new test uses literal v042 root paths for quest, dialogue, resource, service,
transport, recipe, population and bleed definitions. The [old focused suite](inventory-old-suite.log)
passed with the bug, while the [new test failed before the fix](inventory-before-fix.log).
Restoring the [old predicate](inventory-mutant.log) or [deleting the inventory call](inventory-omitted-call.log)
each makes that test fail, exit 1. After restoration, [all four E1 tests pass](inventory-green.log),
exit 0. The [full fix gate](inventory-full-check.log), `mise exec -- bin/check_all.sh`,
passed with exit 0. Independent scoped recheck remains pending.
Author correctness review confirms that actual section children get one root row even
when the map key contains a slash. Ponytail Review: use one depth counter in the existing
walk; no second walker, path parser or new dependency.

## Acceptance still pending

The corrected [full local gate](full-check.log), `mise exec -- bin/check_all.sh`,
completed with exit 0. The earlier gate caught the working-directory bug above;
that failing run was fixed before this retained pass. These are author source checks,
not a valid-candidate runner receipt or independent acceptance.
Final published A–D plus encounter/job/simulator/resource/browser fixes source SHA,
10,000 final-candidate sequences, browser receipts, complete path-to-receipt mapping,
and independent review remain pending. External suite failures currently retain raw
hashed output; complete host-fault scenario export/replay remains a required uncovered
acceptance path. This packaging record is not E1 certification or a milestone closure.

Ponytail Review: existing tools and loader are reused, one simulator export enables
replay, and no dependency, production table, certificate service or general Lab layer
was added. Correctness self-review fixed working-directory resolution and replay of
intentional unknown commands. Fresh independent review remains PM-assigned.
