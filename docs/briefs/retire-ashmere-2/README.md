# Retire Ashmere, phase 2 (full deletion)

Owner, 2026-10-21. An AskUserQuestion answer, quoted: "Fully gone now". It replaced the lean option ("Lean: neutral fixture (Recommended)") chosen earlier the same day. Earlier still, also quoted: "right now we should only be having the showcase, and then rebuilding the real game from 0 after ui polish". Tracking: `loka-4hik.2`.

## Binding plan

[full-plan.md](full-plan.md) is the binding plan. It holds the coverage table, the slices M0-Z and their waves, and the remapped per-file psv with the columns `path|bucket|reason|target|slice|new_target|new_slice`. [plan.md](plan.md) and [files.psv](files.psv) are the first planner's analysis. Their decision 1, keeping r9c, is void: r9c is deleted too.

## Already running

| Slice | Scope |
|---|---|
| L1 (`loka-4hik.5`) | The 19 sampler renames. `rename.sed` (on L1's branch) is the idempotent map. |
| L3 (`loka-4hik.7`) | Deletes the D rows and retires the E1 v042 cases. |

L2, the move to a frozen fixture, is cancelled.

## PM decisions (2026-10-21)

- **D1. New samplers.** Bleed, expedition and population (shoo) get three minimal mechanic samplers with known answers: `bleed_sampler`, `expedition_sampler` and `shoo_sampler`. They also host those transcripts. Samplers are toolbox test cartridges, not story.
- **D2. What "zero hits" means.** The sweep below must find nothing outside these history directories:
  - `docs/{archive,reviews,evidence,decisions,briefs,playtests,rnd,worldbuilding}`
  - `.beads`
  - `package-lock.json`

  Contract fixtures and schema examples that use Ashmere ids are rewritten through the sed map in Z, so they are not exempt.
- **D2 exemption (PM, after Z).** `docs/spec/conformance/contract-links.json` keeps one "Ashmere content policy" label at line 34. The conformance fixtures are frozen and byte-pinned (`docs/spec/README.md:3`, `docs/spec/IMPORT.md:214`, `docs/spec/conformance/README.md:11`), so the sweep's expected result is exactly that one file.
- **D3.** L3 keeps `wisp_fixture.ts`, `priory_fixture.ts` and `c5-provisional-artifact.json`. M6a, M6b and M2b retarget them and then delete them.
- **Review.** Each slice self-reviews and needs green hosted CI before the PM merges it into `retire/ashmere-2`. One reviewer pass runs per wave on the batch head. M1, which deletes save code, gets its own review and record. Z gets its own review.

## Acceptance sweep

Every handback reports its count:

```sh
grep -rilE 'ashmere|missing_child|r9c|bell_of_ashmere|wren|elspeth' \
  --exclude-dir={node_modules,_build,deps,.git,.beads,archive,reviews,evidence,decisions,briefs,playtests,rnd,worldbuilding} \
  --exclude=package-lock.json . | wc -l
```
