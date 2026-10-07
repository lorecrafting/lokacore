# E1 runner primary source review

**CHANGES REQUIRED** — exact source `cf97a4c38b4ce90b2662e0dd06f60a0ae99d6604`,
branch `slice/chapter-one-e1-r9-certification`, against `71c3323d`.
Independent reviewer authored none of the source. This reviews runner packaging;
it does not certify E1 or the final integrated candidate.

## Required behavior

Derived from the [active proof policy](../system/architecture.md#e1-exact-candidate-proof-policy),
[E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md),
[09 §1a/§20](../archive/spec/09-cartridge-lab-certification.md),
[save contract](../system/save.md) and [workflow](../WORKFLOW.md):

- Admit exact independently pinned v042 bytes through the real loader, bind source/check/policy/host identities, and refuse unknown applicability.
- Retain every authored definition and meaningful command/branch/consequence/beat obligation; suite success cannot substitute for its controlled receipt.
- Replay retained initial state and ordered commands while checking the recorded invariant; missing or changed inputs refuse.
- Preserve real SQLite fault/reopen/retry proof, explicit save-pin refusal and owner saves; incomplete proof remains pending and native work remains deferred.

## Open finding

**E1-P1 — blocker — `kernel/ts/test/e1_policy.ts:145–146`.**
`inventory()` treats `/section/<key>` as exactly two slash-separated components,
but actual v042 keys contain `/` (for example
`ashmere_missing_child@0.0.42:resource/hp`). Consequently the root predicate
never records those definitions unless an unrelated `op/type/evidence/control`
field happens to trigger the other predicate. The imported `parts()` walk does
not cover these definition families. Actual missing root rows:

| Section | Missing / authored roots |
|---|---:|
| quests | 10 / 10 |
| dialogues | 54 / 54 |
| resources | 5 / 5 |
| services | 3 / 3 |
| transports | 2 / 2 |
| recipes | 9 / 9 |
| populations | 8 / 8 |
| bleeds | 1 / 1 |

Resources, services, transports, populations and bleeds have **zero** authored
inventory rows, including descendants. Their broad capability obligations remain,
but hp recovery, the inn benefits, ferry routes, population definitions and bleed
parameters cannot receive the required definition-specific coverage disposition.
Thus even the real unchanged candidate produces an incomplete obligation list.
Record roots structurally, independent of slash spelling, and add the smallest
controlled coverage test with independently named definitions. Preserve the
existing descendant branch/beat inventory.

Minimal probe from repository root, source unmodified (exit **1**):

```sh
mise exec -- node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {admitCandidate} from './kernel/ts/test/e1_policy.ts';
const p=JSON.parse(readFileSync('protocol/fixtures/missing_child_v042_hash.json'));
const {policy}=admitCandidate(new TextEncoder().encode(
  `{"cartridge":${p.canonical},"content_hash":"${p.sha256}"}`));
const expected='/resources/ashmere_missing_child@0.0.42:resource/hp';
const found=policy.uses.some(u=>u.path===expected);
console.log('v042 hp definition retained:',found); // false; required true
process.exitCode=found ? 0 : 1;
JS
```

## Verification and limits

- Node 24.21.0, `e1.test.ts` + `cartridge.test.ts`: **81/81 pass**, exit 0.
- Real SQLite `faults`, `recovery`, `saves`, `story_points` test files: **58/58 pass**, exit 0. These are named-suite evidence, not every final chapter commit-path receipt.
- Independent detached-worktree mutations: removing the unknown-policy guard fails its focused test; removing the ordered-command digest comparison fails replay validation (both exit 1, missing expected exception). Restored E1 tests: **3/3 pass**.
- Removing the entire `inventory(c, uses)` call leaves **81/81 passing**, exit 0: the current focused suite does not protect the obligation inventory. Temporary mutations restored and worktree removed.
- Read the actual source diff and retained author controls. Exact candidate hash is literal, refusal expectations are literal, and compile compares to the existing independent fixture. Candidate selection is explicit in simulation; failures cannot produce a certification pass. Runner invokes existing SQLite tests; no owner save, production persistence or frozen oracle was changed.
- Ponytail Review: no independent complexity finding. Existing loader, simulator, tests and platform hashing are reused; fixing E1-P1 needs no new framework.

Final published A–D plus job/simulator/resource/encounter/web fixes, valid-candidate
runner receipts, 10,000 sequences, 30-day proof, path-to-receipt coverage,
host-fault export/replay and final independent gate review remain pending.
Browser smoke belongs to E2/E3; native proof remains deferred. These acceptance
carries are separate from the concrete runner defect above.
