# Disposition, review 759 fix round 2 (loka-wfrgk.42.2)

Written 2026-11-19 21:40 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017, PM session.

The reviewer's RECHECK (`ed37cba66`) accepted every earlier disposition and left two open:
a **should-fix** where my "no gate needed" argument was only half right, and a **nit** that the
`--wield`-with-no-value guard was unpinned. Both are now closed. No product behaviour changes beyond
the prerequisite check.

## should-fix — prerequisite, not qualification, is what combat skips

The reviewer measured what I had reasoned about: a `qualification` gate really is dead code
(`round_attack.ts:220-222` re-reads `qualified`), but combat never reads `prerequisite`, so an
acquisition written by force let a sword win with a skill the player had not *learned the way to* —
rounds `{3,3,3}` → `{2,2,2}`. My original comment asserted the general case from one measurement,
which was the error.

Fixed with `learnable(w, w.character, skill, { n: 0 })` in `kernel/ts/play/wield.ts`, the same bar a
teacher's acquisition step passes. The comment now states both halves: no qualification gate, and why
the prerequisite check is not redundant.

Test: `a weapon whose skill the player has not learned the way to leaves the fight as it was` — a
succeeded sword behind `might at_least 10`, which the clone can never reach. Removing the guard fails
that test and nothing else (9 pass / 1 fail, measured). With the guard: 10/10.

## nit — `--wield` with no value

Now asserted: exit status 2 and `needs an item key`, so a mistyped flag cannot read as "this weapon
changes nothing". Neutering the guard fails that test alone; restored, 10/10.

## nit, not fixed — live.test.ts does not pin the query's value

The reviewer noted a `wield → undefined` mutant survives all eight live tests, because the fixture
cartridge has no wieldable item. Adding one would mean authoring text keys and a slot into a fixture
that tests the route table, not the weapon. The value path is covered end to end at the kernel level
(`fight.test.ts`, both the armed and unlearnable cases) and at the panel level (`Combat.tsx` sends it).
Recorded here as a known gap rather than papered over with a fixture built for the assertion.

## Verified

`tsc -p play` clean, `prettier` clean, `check_ts_size` clean, `fight.test.ts` 10/10, panel E2E 0 fail.
CI waited on the pushed head; the merge records it.
