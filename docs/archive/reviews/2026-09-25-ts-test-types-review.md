# Review: type-check the TypeScript tests (PR #24)

- PR: #24 `ts-test-types`, commit reviewed `f3d83b7`
- Reviewer: independent agent (authored none of this); tooling PR, short review
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. The owner approved `@types/node`, and the decision record holds his words verbatim.
2. `kernel/ts/src/` still rejects host and Node APIs: Node types reach only the tests.
3. `npm run typecheck` checks both `src/` and `test/`, and CI runs it.
4. Dropping `test/subset.gen.ts` from the kernel config loses no coverage.
5. The new red control fails when test files are not type-checked.
6. The type fix is the smallest honest one; the dependency is pinned and the lock agrees.

## Checks

- Decision record: `docs/decisions/owner-decision-ts-test-types-2026-09-25.md` is
  byte-identical (`cmp`) to the coordinator's copy of the owner's reply.
- `test/tsconfig.json` extends `../tsconfig.json` and overrides only `types: ["node"]` and
  `include`. `lib` stays ES2022, so there is no DOM.
- A planted `process.env` in `src/` fails `npx tsc` (TS2591). The script's six host/Node probes
  and the `node:` import still fail.
- The kernel config included `test/subset.gen.ts` so the generated probe would be type-checked
  (547da5d, Astra A3). `tsc -p test` now checks it with the same strict options. The file is
  generated data with no host APIs. `src/contracts.gen.ts` is still checked under `types: []`.
- `npm run typecheck` is `tsc && tsc -p test` and passes clean. The CI `typescript` job runs it
  (`ci.yml:77`).
- New red control: `bin/kernel_red_controls.sh` passes as a whole. After reverting `typecheck`
  to `tsc`, the script fails with "typecheck accepted a type error in a test file", so the control
  bites.
- `as Defs`: without it, `tsc -p test` reports the three expected errors
  (`validate.test.ts:17,24,53`). Generated `DEFS` values are `unknown`, and `src/validate.ts:51`
  already casts with `DEFS as Defs`, so the test follows the existing pattern. Exporting a type
  alias is erased at runtime and adds no API surface worth guarding. `Parameters<typeof
  validate>[2]` would avoid the export but reads worse.
- `@types/node` is pinned exactly to `24.13.6`, matching the Node 24 engine. The lock adds only
  `@types/node` and its `undici-types` 7.18.2 (satisfies `~7.18.0`), and `npm ci` succeeds.
- `npm test`: 33/33 pass.

## Findings

- **should-fix (merge order), `docs/decisions/README.md:34`**: conflicts with PR #22
  (`sweep-docs`). Both PRs append after the ADR-074 entry, and `git merge-tree` reports the
  conflict. Resolve it by keeping both lines. Whichever PR merges second rebases.
