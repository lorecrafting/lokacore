# Post-D10 authority fixture repair — 2026-10-06

Base: published `main` at `87ac4cbb`. Branch: `fix/post-d10-authority-fixtures`.
This is a test setup repair under [Opening a story and Receipts](../system/save.md#opening-a-story),
[D9 recovery](../system/save.md#d9-village-consequence-recovery) and the
[pre-production decision](../decisions/owner-decision-preproduction-compatibility-2026-10-04.md).
No production implementation, frozen conformance fixture or owner save changed.

## Observed baseline and repaired behavior

The baseline command, run before editing after installing the pinned dependencies, was:

```sh
mise exec -- node --test --test-reporter=spec 'mobile/authority/**/*.test.ts' mobile/app/book/food.test.ts
```

On the published base it exited 1: 461 tests, 436 passed, 24 failed, one pre-existing
skip. The failures were D9 (4), transport (7), water (9), Western Ashmere (3), and
Book food (1). After repair the same command exited 0: 461 tests, 460 passed,
zero failures, the same one skip. No test was removed or newly skipped.

- Release fixtures now use genuine `newWorld` genesis. Setup commits ancestry once
  through authority invocation. The existing kernel-only `fresh()` behavior remains.
- D9 obtains quests and facts by the existing accepted story route. Its controlled
  Study cartridge authors a deterministic rat; accepted Take, Attack and elapsed
  combat create the real corpse, followed by cold reopen. It no longer replaces a
  save with receiptless state or manually creates an elapsed checkpoint.
- The stripped transport fixture removes dependent expedition, crow corpse and
  suppression declarations along with populations. Its crossing still reopens,
  and removing the committed transport event still refuses corruption without
  changing the database.
- Book's service reference comes from the fixture manifest. Western Ashmere keeps
  literal text, locations and state assertions; its obsolete whole-source digest
  assertion was removed because it detected unrelated authored source changes.

The focused command exited 0 after restoring all temporary mutants:

```sh
mise exec -- node --test --test-reporter=spec mobile/authority/local-story/{transport,water,western_ashmere,d9}.test.ts mobile/app/book/food.test.ts
```

Result: **25 tests, 25 passed, zero failures or skips**. These include real SQLite
cold reopen, genuinely failed COMMIT, uncertain absent/committed outcomes, lost
acknowledgement, same-invocation replay, transport receipt forgery and malformed
water/history rejection with unchanged saved rows. The authority glob also passed
the existing ancestry, recovery, general faults, saves and Start over controls.

The full active `bin/check_all.sh` on the original repair exited **0**: 401 ExUnit tests passed; kernel
TypeScript typechecking and the full kernel Node suite (including the headless
simulator) passed; contract/content, boundary, lint, docs/tracker, formatting,
size and planted red controls passed. A final documentation check after adding
this evidence and its link also passed.

## Deliberate red controls

Each temporary mutation ran only its existing focused test with Node's
`--test-name-pattern`, exited 1 with one failing test, and was restored afterward.
No additional test was needed for these breaks.

| Mutation | Existing test that failed | Observed failure |
|---|---|---|
| Transport release setup uses selected `fresh()` instead of `genesis()` | paid crossing, free Sedge lesson, six-room exploration and return reopen at committed boundaries | `save_corrupt` instead of `open` |
| Omit the Study key's accepted Take before death | real SQLite fox Study corpse permits pickup then closes ingress after cold reopen | recovery entrance rejected instead of accepted |
| Restore Book service version `0.0.32` | actual Book Item Eat returns World once on normal and uncertain settlement and cold remount | `unsupported_capability` rejection instead of acceptance |

## Review and limits

Ponytail Review: no new framework, production abstraction, fabricated receipt or
validation bypass. Correctness self-review checked unmodified release genesis,
once-only ancestry, distinct invocation IDs, deterministic real death, replay,
fixture reference integrity and unchanged behavioral assertions. Two type errors
in the first D9 assertion revision were caught by the active check and fixed before
handoff. Test size allowances retain the shared SQLite fixtures (transport 563
lines, water 507); independent review should confirm that splitting is less clear.

Native/mobile verification remains paused; these are explicitly requested Node
fixture checks. The full headless engine simulator remains in the active check.
No browser, phone, native build, owner save, push or PR was used. Independent review
and integration with later `main` remain PM steps. This record summarizes observed
results; raw transient console logs are not committed.

## Independent review correction R1

The reviewer found that the transport-only test still passed when only the
transport trigger was removed from `liquidSave`: other retained declarations
also invoked accepted-history validation. This was a test-isolation blocker.

The controlled fixture now also removes knowledge and map/Knock declarations,
water, food and its dependent edible/bandage/bleed declarations, readable item
metadata, careful Harvest and shop discounts. The loader accepts the resulting
cartridge; accepted crossing, cold reopen, literal `[1, 2]` balances, forged-event
refusal and unchanged-database assertions remain.

The exact review mutant deletes only
`!Object.keys(fresh.cartridge.transports ?? {}).length &&` from `liquid-save.ts`.
Running the existing transport-only test exited **1**, at its forged-event
refusal: actual `open`, expected `save_corrupt`. The production file was restored
immediately. With the guard restored, the focused 25-test command above exited
**0** (25 passed, zero failures/skips), including real SQLite corruption and fault
controls. `mise exec -- npm run typecheck` in `kernel/ts` also exited **0**.
Documentation and formatting checks passed. The full gate was not repeated for
this fixture-only correction; the original full-gate result remains above.

Ponytail Review and correctness self-review found no further issue: the change
extends the existing fixture reduction, adds no test or helper, and changes no
production guard. Independent reviewer recheck remains required.
