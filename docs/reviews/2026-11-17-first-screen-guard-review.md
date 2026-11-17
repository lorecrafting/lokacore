# Review: the first screen's guard refuses only an unreadable save (loka-vduxr.39)

Written 2026-11-17 04:27 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017.
- Branch `fix/39-first-screen-bug`, uncommitted working tree on `169314b64ae95970c45b0fa1d42759a0691200a1` (equals `origin/main`; the slice is the working-tree diff, 3 files).
- Governing: [save.md, What reopen proves and Opening a story](../system/save.md#what-reopen-proves), the [#574 second review](2026-11-01-fast-open-second-review.md) (its nit at `:102` is this bead), [storage lessons](../lessons/storage.md) (reopen principle), [mobile lessons](../lessons/mobile.md).
- CI at this head (`gh run list --commit 169314b64`): main's head, no run for the slice (uncommitted). Not run.
- `/code-review medium`: not reported (no PR). `bin/mutate_diff.sh`: not run; four targeted mutants below.

## Must be true (written before the diff)

1. A throw from `gameView` on an intact save reaches the player as a plain fault, `startOver=false`, save kept.
2. Every save that *is* damaged still refuses with `save_corrupt` and Start over — the fix must not turn a real corruption into a stuck screen.
3. The narrowing matches the narration guard and `store.ts` `unreadable`, one rule in one place.
4. A test names the break and fails on the widened guard, and does not pass for an unrelated reason.
5. `save.md` states something true about all reads opening makes, and does not restate a fact held elsewhere.

## Findings

### Blocker 1: the fix breaks two existing save-corruption tests

`mobile/authority/local-story/session.ts:72`. With the slice applied, `start_over.test.ts` fails 2 of 15; on `main` (guard widened) it passes 15 of 15. Full authority + Book suite at the slice: 1523 pass, 2 fail.

```
✖ a save with no body row: save_corrupt, Start over repairs it in place
✖ a save with an empty resource: save_corrupt, Start over repairs it in place
  actual [undefined, false] vs expected ['save_corrupt', false]
```

Probes (real SQLite, ferry fixture, `localSession` exactly as `start_over.test.ts:329` forges them):

| Forged row | main | slice |
|---|---|---|
| `DELETE state_row containers/<BODY>` | `save_corrupt`, Start over | untyped `Cannot read properties of undefined (reading 'exits')`, no Start over |
| `UPDATE state_row SET value='{}' WHERE section='resources'` | `save_corrupt`, Start over | untyped `precondition_failed`, no Start over |

So the keystone requirement 2 fails: two shapes that are a damaged save on `main` become a permanent unopenable screen with no way forward. Both rows are exactly what `save.md` calls a damaged save, and both were red controls R6P-A02 / ROADMAP SM2a wrote for this guard.

The cause is not that `unreadable()` is the wrong predicate in isolation — it is that `checked` sits in front of two readers whose refusals are *mixed*: `gameView` throws `KernelError('precondition_failed')` for a corrupt resource row (`view/resources.ts:41`), and `view.ts:78` dereferences an unknown container target straight into a `TypeError`. Before this slice the widened guard caught both by accident; after it nothing does.

### Blocker 2: the new test's forged row is not a bug of ours, and the test cannot tell the two apart

`mobile/authority/local-story/open_catch_up.test.ts:283-310`. The forged row is

```js
void sql.exec(`UPDATE state_row SET value = '"no-such-entity"' WHERE section = 'containers'`)
```

which points *every* container (the body, Bram, the lantern) at a room id no entity has. The suite is green only because `view.ts:78` hands the undefined room to `placeView` (`:133`) and `.name` throws. That is not "a bug of ours in `gameView`"; it is a hand-edited state row that no accepted command can produce — the same class `save.md` says must refuse as `save_corrupt`. So the test asserts the opposite of the spec for the row it forges: it pins that a genuinely damaged save must NOT offer Start over. Requirement 2 is what makes this visible; the test plus the code change together teach the wrong rule.

The mutant check also mis-specifies the break. Reverting **only** the new `if (!unreadable(e)) throw e;` (leaving the narration guard alone) does fail the test at `:294` (`startOver` true !== false) — so the author's "it failed against the reverted fix" is reproducible. But that is the *widening* direction. The test passes for the wrong reason: it goes green not because a bug keeps the save, but because this particular forged row is a reader `TypeError` that the narrow guard now lets through. Any future re-widening to also accept `KernelError` (a plausible next change, since that is the resource case) keeps this test green while re-breaking nothing — the test does not triangulate the bug-vs-damage boundary at all.

Recommendation: the test must forge a shape the kernel genuinely crashes on in code we own — a `TypeError` in a *derived* read with all rows lawfully shaped — not a row no command can write. With finding 1 unresolved, no such case exists that also keeps the damaged shapes refusing, which is why findings 1 and 2 are one problem.

### Should-fix: the doc sentence states the rule but the code does not yet obey it

`docs/system/save.md:48-51`. The added sentence is true of `unreadable()` and true of the narration guard, and it does not duplicate a fact held elsewhere (the `:46` sentence covers a `TypeError` generally; this one names the two reads opening makes). Wording is fine. But it says "a row of ours that throws there is a plain fault, not a refusal", while a corrupted `resources` row (`precondition_failed`) and an unknown container target both *refuse* today — the sentence overstates in exactly the way the bead's title complains that `save.md:46` did. Land it with finding 1 resolved, not before.

Also state the direction the sentence leaves out: it should say what a *refusal* from these reads is, since after finding 1's fix `KernelError('precondition_failed')` must count as one. Suggested text once the code matches:

> `session.ts` `checked` refuses a `SyntaxError`, a `malformed JSON` fault, or the kernel's own `precondition_failed` on a stored row it cannot read; any other throw is a plain fault with the save kept.

### Nit: the comment describes the old behavior, and the `ponytail:` note is the open bead

`session.ts:68-71`. "A world a reader refuses (a row of the wrong shape) may be a bad save" is now false for exactly the case the resource reader raises, per finding 1. The `ponytail:` line already concedes the gap ("a future reader that refuses a shape with a plain Error would read as a bug here") — that is this slice's unsolved half, so it should be a Beads id, not a comment, per the `ponytail-debt` convention.

### Answers to the five questions

1. **Third read at open?** No third *catch*, but two readers behind the one catch that still turn a damaged save into a non-refusal (the two rows in finding 1). I grepped every `catch` at open: `session.ts:67` (this one), `session.ts:80` (narration, already narrow), `authority.ts:108` (rethrows non-`ElapsedRecoveryError` — a `KernelError` there escapes untyped), `authority.ts:133` (`CatchUpRefusedError` only, correct), `store.ts:132` (`unreadable` only), `chronicle.ts:43` (already allows `TypeError`). `localStory` has no catch of its own; `localSession:276` classifies by `corrupt(e)` only. So the fix is complete as a *narrowing* but not complete as a *classification*, which is what the bead asks.
2. **Does the test name a realistic break?** Partly. It fails on the widening mutant (verified, `:294`), so it is not a change detector. But its forged row is a damaged save, not a bug, so it pins wrong behavior (blocker 2).
3. **Is `unreadable()` the right test?** No, not alone. `precondition_failed` on a stored row *is* a refusal (`save.md:44`, the reopen principle: "a row the kernel would throw or hang on at the next command"). A forged `resources` row giving `precondition_failed` with **no** Start over is **incorrect** per `save.md` — main has it right, the slice regresses it. `KernelError` must be a refusal here; only a `TypeError` (and I/O errors) are "ours".
4. **Doc true, duplicated?** True of the predicate, not yet of the code (should-fix above); not duplicated.
5. **Lessons contradicted?** `storage.md:44-48` (reopen refuses a row the kernel would throw on at the next command) is what the slice now violates for the two rows. `mobile.md` says nothing about this path; nothing else conflicts.

## Mutants run (each, `node --test` on the authority files)

| Mutant | Result |
|---|---|
| M1 revert only the new `if (!unreadable(e)) throw e;` (widened guard back) | red, `open_catch_up.test.ts:294` `startOver` true vs false |
| M2 remove the guard entirely, always `throw e` | red, `start_over.test.ts:336` x2 (same two rows as finding 1) |
| M3 slice applied, full authority suite | red x2 (`start_over.test.ts:336`), 1523/1525 |
| M4 `!(e instanceof KernelError)` added to the guard | `start_over.test.ts` empty-resource case green; *new* test goes red for its forged container row (`TypeError`, not `KernelError`) — confirms the two rows need two different answers, and that the new test cannot separate them |

M4 is the useful one: it shows the fix is not a one-predicate change. The resource case needs `KernelError` accepted; the container case needs either `load` refusing an unknown container target (a real `save.md` reopening check the save path lacks) or the new test replaced.

## Verdict

CHANGES REQUIRED.

No disposition to verify yet; this is the first round. On a fix round I will review only the fix commits and re-run M1 to M4.

## Disposition (2026-11-17, Pi harness, deploy/deepseek-ai/deepseek-v4.1-flash-1017)

**Withdrawn, not reworked.** The author reverted `session.ts` and the test rather than take finding 1
on; branch `fix/39-first-screen-bug` was deleted. `start_over.test.ts` is back to 15/15 on `main`.

What shipped instead is finding 3's narrow half: `docs/system/save.md` no longer claims a `TypeError`
is never a bad save *everywhere* — it says that at a row a loader reads, names the first screen as
the deliberate exception, and cites the test that pins it. That was the only part of the bead whose
premise held.

Finding 1 stands as the reason the bead is not a code change: a deleted body row and a forged
container id both throw `TypeError` from the same `checked` catch, so no throw-shape test can
separate a damaged save from a bug of ours. Finding 2's conclusion follows — the slice could not
write a test that forges a bug rather than a damaged row, because at that catch the two are the same
observable. `loka-vduxr.39` records the three options an owner decision has to choose between,
including M4's direction (accept `KernelError` as a refusal, and make `load` refuse an unknown
container target) which is the only one that keeps both rows working.

The lesson worth keeping: **a catch that guards a screen, not a row, cannot classify by exception
type** — the damage and the bug arrive as the same throw. Classify where the row is read, or not at
all.
