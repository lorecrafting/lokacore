# Review: death and level bug batch (PR #623; loka-3tc7, loka-g5hh.2.11, loka-dbtxr (a))

- PR: [#623](https://github.com/lorecrafting/lokacore/pull/623), branch `fix/death-level-bugs`
- Reviewed commit: `b39fc3bccc6679f3a210a2d9a41e4e902733d7a6`
- Governing: [book-ui.md](../system/book-ui.md) (Falling, "A level is never dropped", the away recap, :133), [mechanics.md](../system/mechanics.md) (levelling "Reading", death-penalty "Line"), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit b39fc3bcc...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body (two rounds).
- Out of scope per brief: kgd.210 (owner decides), dbtxr (b) (needs a host API).

## Must be true (written before the diff)

1. The level line goes before the first line said by a rule answering the actor's own `level_reached`; a silent or failed rule leaves it at the end.
2. No Elixir/TS divergence; saves and replays are unaffected.
3. A turn or card holds a pending level, the latest level wins, and the scheduler re-steps it.
4. A held level haptic waits out the curl and is cancelled by a death or by the Book going.
5. The room bed is cut on death, returns on waking, and is silent under the fatal card.
6. A recovery-room death ends recap holding; its lines never enter a recap (book-ui.md:133).

## Checks that held

- `lines.ts:46` `say()` pins only on a line said; `proposal.ts:274` is its only caller. Elixir `levelling.ex` only validates content, so there is no parity surface. Narration lives in receipts; the replay invariants replay ops and state, not narration. No fixture or transcript changed, which is as expected: only `levelling_sampler` has `level_reached` rules, and both of them narrate.
- `cues.ts:146-165`: the last held level is kept, and the scheduler re-arms at `q.until` while `pending` is set.
- `useCueSounds.ts:24-27` cuts the room under the fatal card. `'fell'` keeps `room`, so waking restarts its bed (`sound.web.ts:287`).
- `presenter.ts:106` `away.from = Infinity` is not a bug. It sends the earlier held lines to the log in order, which is the book-ui.md:133 rule and what `holding()` already does on a room change.
- Disputed items accepted: `'fell'` keeps the room; the death cue's `music()` clears the fanfare; `say` lives in the death module.

## Mutants

`bin/mutate_diff.sh origin/main`: 28 mutants, 28 red-narrow, exit 0. This matches the PR body.

Hand mutants:
- Drop `presenter.ts:106`: recap.test red.
- `cues.ts:165` `.at(-1)` to `.at(0)`: cues.test red.
- Drop `clearTimeout` at `cueSounds.ts:62` (teardown): cue_sounds.test red.
- Drop `clearTimeout` at `cueSounds.ts:80` (death): **green**.

## Findings

1. **Blocker**, `mobile/app/book/cue_sounds.test.ts:223-236`. The death's `clearTimeout` (`cueSounds.ts:80`) is untested. In the test, the later held level calls `clearTimeout(waiting)` (`cueSounds.ts:17`), which cancels the pre-death timer whether or not the death cleared it.
   - Failure scenario: a regression drops the clear, and a level held under a curl then fires its medium haptic after a death's heavy one outside a fight. The suite stays green.
   - The PR body's claim "Red without `clearTimeout`" therefore holds only for the teardown clear.
   - Fix (verified red on the mutant, green on the head): after `playCue({ name: 'death', fight: false })`, add `await wait(60); assert.deepEqual(felt(), [['haptic', 'heavy']]);`.
2. **Question**, `presenter.ts:106`. The lines of a recovery-room death still wait for `settle()` rather than showing at once. This matches existing settlement behaviour; no failure scenario.

## Verdict

CHANGES REQUIRED (finding 1 only; a test-only fix).
