# Review: replay of failed and unknown commits, and a test hang (PR #627, loka-vduxr.42, loka-votey)

- PR: [#627](https://github.com/lorecrafting/lokacore/pull/627), branch `fix/kernel-hygiene`
- Reviewed commit: `bde2c03781c301688c160fa53681d9dc18abfe17`; reviewer docs push `5de569884` (fast-forward) on top of it
- Governing: [ADR-075 §4](../archive/decisions/adr-075-observability-proposal.md) (game trace, the vduxr.41 and vduxr.42 amendments), [architecture Observability](../system/architecture.md#observability), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit bde2c0378...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: reported in the PR body (medium, 8 findings).
- PM rulings accepted, not raised: `run.ts:108` (a lone unknown row would shift later ordinals, latent), `why.ts:43` (Why at a failed ordinal explains its decision), `main.ts:295` (`--replay` narrates failed rows).

## Must be true (written before the diff)

1. Replay of a `failed` or `unknown` row recomputes the decision from the inputs and adopts neither world nor revision; a `failed` row takes its ordinal, an `unknown` row leaves it to its follow-up.
2. The recorded commit is kept for those rows (PM ruling a), and the ADR says so with no open marker.
3. Replay stays a pure function of the trace: deterministic, no save, protocol or schema shape change.
4. Coverage counts as exercised only what a playtest really committed (PM ruling b).
5. Why and coverage address rows by ordinal correctly when an unknown follow-up repeats one.
6. The new test is red on the pre-fix behaviour; `settled()` fails a pending await without masking a wrong value or message.

## Checks that held

- No file under `protocol/`, save or schema changed; replay reads only the trace (deterministic).
- `{ ...r }` copy: a hand mutant to `r` is red; the kernel step returns a new world (the retry row replays byte-identical).
- Red before the fix: mutant `if (true)` at `run.ts:105` (adopt every row, the old behaviour) is red in `trace_refused.test.ts`.
- Hand mutants against `trace_refused.test.ts`, all red-narrow: `run.ts:105` `&&`→`||`, `run.ts:108` `===`→`!==`, `why.ts:84` `1..`→`2..`, `why.ts:109` `<`→`<= ordinal - 2`. These back the PR body's mutant claims.
- `settled()`: planted `ms = 5001` in `ask_trace.ts` is red-narrow, not a hang. A wrong message or value still fails its own assertion, since `p` wins the race when settled.
- ADR text states plainly that replay keeps the recorded commit; "PM to confirm" removed (lines 11, 157) in `5de569884`.

## Mutants

`bin/mutate_diff.sh origin/main`: 17 mutants, 16 run; 12 red-narrow, 1 NOT-UNIQUE (`run.ts:110`), 4 SURVIVED (`run.ts:105` `&&`→`||`, `run.ts:108` ×2, `why.ts:84`). The survivors are reached only by `trace_refused.test.ts`, which runs the tools as subprocesses (no import hop); the hand mutants above clear `run.ts:105`, `run.ts:108` `===`→`!==` and `why.ts:84`. No TIMEBOX rows.

## Findings

1. **Should-fix**, `kernel/ts/play/coverage.ts:67`. `each` runs for every row, and the filter at `:79` checks only `d.kind`. A `failed` or `unknown` accepted row, decided on a copy, still adds its narration markers, `action_completed` and `quest_resolved` to `seen`/`done`. Scenario: a playtest whose `perform` firing reaction X hits a storage failure, and the player does not retry; coverage omits X from `never.reactions` though no committed path ran it. This breaks PM ruling (b). Fix: skip the callback when `e.data.commit.state` is `failed` or `unknown`, and add a test where X is reached only through a failed row.

## Verdict

CHANGES REQUIRED: one should-fix, and it is a logic change, so it takes a fix round ([small should-fix](../WORKFLOW.md#small-should-fix)).
