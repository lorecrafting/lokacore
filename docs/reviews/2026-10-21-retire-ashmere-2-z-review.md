# Review: Retire Ashmere 2 Z, final deletion (loka-4hik.29)

- Branch `retire/ashmere-2-Z`, exact commit `2bb9ca2f918f5af7a41d759e17905f39ac3129aa`, base `4df57d6fc92dcdf69403b8f9d10ac3cb3b3e9273`.
- Governing: [owner decision: retire the first chapter](../decisions/owner-decision-retire-first-chapter-2026-10-21.md), [AGENTS.md pre-production](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent), [E1 certification](../system/e1-certification.md), [conformance fixtures](../spec/README.md) (frozen) and the [import record](../spec/IMPORT.md).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.

## Must be true (written before the diff)

1. Every deleted test either pins chapter story only, or a surviving test at the same layer catches the break it guarded.
2. E1 still refuses an admitted cartridge with no candidate row and a candidate whose hash changed. The new row's hash is the frozen KAT, not a kernel run.
3. Schema examples and contract fixtures change only in ids, using rename.sed-style neutral names. No schema meaning changes, and no expected value comes from a kernel run.
4. No `lib/` or `kernel/ts/src` runtime change. `contracts.gen.ts` is regenerated from the schemas.
5. The sweep hits only frozen conformance input, and docs links resolve.

## Checks run

- **1.**
  - r9c_faults rows (old `r9c_faults.test.ts:213/242/292/325`) and their surviving covers:
    - F1: `infirmary.test.ts:103`
    - F2: `scene.test.ts:98` and `faults.test.ts:213`
    - F3: `faults.test.ts:357`
    - F4: `transport.test.ts:167`
  - Mutant `invocation.ts:60` `if (false && old)` is killed: 6 fails, among them scene:98, transport:167 and infirmary:103.
  - Mutant `sequence.ts:151` `if (false)` survives `combat_flee.test.ts`. The developer's log shows it also survived the deleted r9c tests, so the deletion lost no coverage. See finding 2.
- **2.**
  - `e1_policy.ts:14-17` is the recipe_sampler row.
  - I recomputed sha256 of the `cartridge_bell_hash.json` canonical: it equals `ec0d0dfd…` (frozen in L1).
  - The developer's red controls on the row check and on the hash compare both fail as expected.
- **3.**
  - All 14 changed schemas are semantically equal once examples and descriptions are stripped. The `contracts.gen.ts` hunks change example strings only.
  - All `protocol/fixtures/*_hash.json` are self-consistent.
- **4.** No `lib/` changes. The only src change is the generated `contracts.gen.ts`.
- **5.**
  - The sweep prints 1: `docs/spec/conformance/contract-links.json:34`. That file is pinned byte-identical with 0 edits (`docs/spec/IMPORT.md:214`).
  - The rule basis is `docs/spec/README.md:3` (frozen fixtures) and `docs/spec/conformance/README.md:11` (no rewriting of expected answers).
  - `elixir bin/check_docs.exs`: exit 0.
- **Ruling 4 (no version bump): agree.** `cellar_sampler` was born in L1 (4f2475d19), and L1 is not on `origin/main`. No release ever carried that id, and pre-production has no release compatibility.

## Findings

1. Note, `docs/briefs/retire-ashmere-2/README.md:21`: D2 still demands zero hits, but the sweep prints 1. Failure scenario: a later sweep run reads D2 literally and reports red. The PM will record the contract-links exemption, citing the three lines above.
2. Question, `kernel/ts/src/mechanics/movement/sequence.ts:151`: removing this guard changes no tested result. The refusal is still asserted at `combat_flee.test.ts:123-136`, so the line looks redundant. This existed before Z.
3. Nit: the per-row covers for the deleted r9c E2 tests are named only in this record, not in the commits or the handback the brief asked for.

**Verdict: APPROVE WITH NOTES**
