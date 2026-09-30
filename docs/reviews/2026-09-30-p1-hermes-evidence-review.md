# Review: R6 P1 adapter known answers on iOS Hermes (iPhone 11)

- PR: #67 (`r6-p1-hermes-evidence`), commit reviewed `a8d172d` (base `7d56480`).
- Scope: docs/evidence only. No mutation testing (no code changes). Depth: short.
- Verdict: **APPROVE WITH NOTES** (two nits).

## What must be true (written before reading the diff)

1. The raw device log shows every frozen case by name with a result, and 0 mismatches.
   Those cases are `invocation_cases.json` at `7d56480`: items 3 cases / 11 steps, dusk
   1 case / 1 step.
2. The wiring builds each world the way the Node suite does: same context id, seed
   `[1,2,3,4]` for items, and `numeric-vectors.json` `rng_steps[3].state` for dusk.
3. `SHA256SUMS` verifies. It does not list itself or its verify file. The folder is
   `-whitespace`.
4. No UDID, ECID, serial, device name, team id, certificate or provisioning id, home or
   worktree path, or container UUID in the diff, commit message or PR body.
5. The lack of an on-device red control is stated, and it does not make the pass vacuous.
6. The ROADMAP P1 edit is one accurate sentence.

## Checks

1. Met. `p1run.txt:3-7` names all four cases, each PASS, then `mismatches=0`. The case
   names and counts match `kernel/ts/test/invocation_cases.json` (3 items cases with
   3+1+7 steps, 1 dusk case with 1 step). That fixture is unchanged in this PR.
2. Met. `docs/spec/conformance/numeric-vectors.json` `rng_steps[3].state` =
   `[27274249, 25704967, 31982592, 12605441]`. This matches `dev-App.tsx.txt:32` and
   `kernel/ts/test/invocation.test.ts`. The context UUID `0d4e8a5c-...` is the test's
   `CONTEXT`, not a device id.
3. Met. `shasum -a 256 -c SHA256SUMS` on the extracted tree: 3 × OK. `SHA256SUMS` lists
   neither itself nor its verify file. `.gitattributes:3` `docs/evidence/** -whitespace`.
4. Met. Grepped the full diff, commit message and PR body for UDID/ECID/serial, `/Users/`,
   the owner's name, team or provisioning ids, 8-4-4 hex UUIDs, 40-hex strings and
   container paths. The only long hex strings are the three hashes and the test context.
   Placeholders `<device>` and `<team>` are used. `../lokacore-p1-hermes` in README step 1
   is a relative sibling path. It shows no home or user name.
5. Met. The pass is not vacuous. The device prints one PASS or FAIL line per fixture
   case, and every case name comes from the imported fixture. So an empty or unloaded
   corpus would show no case lines, or an ERROR line (`dev-App.tsx.txt:30-35`). The same
   `run` has a Node red control: `invocation.test.ts`, "a mismatch reports the step...",
   gives a wrong expected result and asserts the mismatch report. The limitation is
   stated at README:16.
6. Met. One sentence. It fits the batching decision ("must pass before S3 merges").

## Findings

- **nit** `docs/evidence/2026-09-30-p1-hermes-iphone11/README.md:14-16`: the bullet
  labelled "Not checked:" holds facts that were checked (lock state read with `devicectl`,
  the run completed). Only the red control was actually not checked. A reader sorting
  facts by label (evidence lessons: "keep ... labeled") files the lock state under
  unchecked. Move the lock state to Inspected and keep only the red control under
  "Not checked".
- **nit** `README.md:3-4`: the step counts "11 steps" / "1 step" come from the fixture,
  not from the device. The device log reports per-case results only. They are not
  device-reported, but the README does not say so. Adding "(steps from the fixture)"
  would do.
