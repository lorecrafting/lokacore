Written 2026-11-13 19:15 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017
# Review: W2 rename rewrites checkpoints

PR [#726](https://github.com/lorecrafting/lokacore/pull/726), branch `w2-rename`. Scope: `rename.test.ts`,
`scene_card.ts` (`moved`/`renamed`), `guard.ts` (`guarded`), `write.ts` (`done`/`record`/`undo`). No tests run.

## Verdict

APPROVE WITH NOTES. Kind-qualified match, one write, one journal entry, undo byte-exact.

## Findings

- should-fix `scene_card.ts` `moved`: matches `:${kind}/${from}"` only, never the `<cartridge>@<version>`
  half, so a rename in `0.0.2` rewrites a checkpoint recorded against `0.0.1` and counts it.
- should-fix `checkpoints.ts:50`/`guard.ts:76`: `names` takes every `checkpoints/*.json` but `guarded`
  allows `[a-z0-9][a-z0-9_-]{0,63}` (and `create` refuses `checkpoints/`), so `Well.json` or a deleted
  checkpoint makes `/undo` refuse for the whole entry: both stay renamed.

## Mutation claims

All four caught: "every checkpoint regardless of kind" and "key only, ignoring kind" by
`a ref of the same key under another kind keeps its bytes` (count 0 + bytes), also test 1's count;
"`checkpoints: 0`" by test 1's `assert.equal(..., 1)`; "skip the checkpoint Change" by test 4's undo
byte equality (`NAMES_WELL` back with `ROOM`).

## Departures

None beyond the brief: `checkpoints: changes.length - 2` and reading each checkpoint from disk are the
simplest correct shape. Verdict stands at APPROVE WITH NOTES. Not committed (review-only mandate).
