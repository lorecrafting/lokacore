# Review: showcase slice D, cause and effect in Low Wardle (PR #374, loka-y6yg.4)

- PR #374, branch `toolbox/showcase-d`, head `1504efaa15cfac8b7c069fe8bcd1cc50803611df`.
- Governing: [plan 3](../showcase/cause-and-effect.md) "Hard rules", "Steps", "Pins the build writes"; [CHECKS.md size rule](../CHECKS.md); [SHOWCASE.md matrix](../SHOWCASE.md#pairwise-mechanic-matrix).
- Hosted CI at head: ci 38107764266, book-e2e 38107764283, graph-diff 38107791497, all success.
- Verdict: **CHANGES REQUIRED**: no blocker, one should-fix (test file split), two nits.

## Must be true (written before the diff)

1. No new line explains a cause or judges the player; `npc.warden.engage` and `scene.letter_ash.2` rewritten.
2. Pick and deliver change nothing beyond plan 1; `sign_social` untouched; no new Character/Journal surface beyond Lore.
3. The fuse sits on the strongbox item, speaks no line, and its expiry sets `warden_knows` once.
4. The Warden is hostile only at trust 0; the ledger mends him; his walk is a detour, not a wall.
5. Wat's ash variant precedes chilled; `knows_ash` reaches Wat, Tam, Nell at 14:00 d1, 15:00 d1, 11:00 d2 and never in the deliver world.
6. `nell_ash` opens before `nell_rumour`; `think_letter` has a distinct alias and grants once.
7. Hash fixture matches the source; recap pin unchanged.

## Proof

- 1-7 checked line by line against the cartridge diff; all hold. `sign_social`, `showcase_recap.test.ts` untouched; item statuses never reach `gameView` (`kernel/ts/src/view/resources.ts:48`: body only).
- Local, head: `showcase_social.test.ts`, `book/showcase_recap.test.ts`, `mix test test/loka/content_showcase_test.exs`, `npm run typecheck` (kernel/ts): all exit 0.
- Mutants (content + regenerated fixture, social file only), all red: `tam_hears_wat` without `when` (20); Wat's `"16"` dropped (21); Warden case at 12:00 (17, 18).
- PR claims rerun: "ash variant after chilled: 19" backed; "Wat's 14:00 case always applies: 19, 20" backed (plain `"14": "warden_gate"`).
- Probe: engaged by the Warden on the green at 13:30 d2, wait to 14:01: no throw, he is at the gate, encounter cleared.

## Deviations

1. `tick_every` 86399: agree. `lib/loka/content/status.ex:85` refuses `tick_every >= duration`; the tick is silent (pinned, social 17).
2. `PINNED = []`: agree. A stale pin fails the test by design; hosted sim green at head; loka-th7x records the lost reproducer.
3. `size: allow 650` (`kernel/ts/test/showcase_social.test.ts:1`): do not agree; see finding 1.
4. World id in the Book: no change required. A new save draws a random v4 context and seed (`mobile/authority/local-story/authority.ts:146-156`, fed `random` by `mobile/app/App.tsx:83`); no cartridge or Book setting picks it, so "day 1 hot" was one draw. Pinning it is an app lineage change (ADR-075), beyond a content slice. The owner script does not depend on frost: Wat's ash variant outranks chilled, chill lines are only in kernel step 21, Tam's schedule reads rain only, and day-2 rain is already named in the script.

## Findings

1. should-fix, `kernel/ts/test/showcase_social.test.ts:1`: CHECKS.md allows `size: allow` only when a split is worse. The stated reason ("share module-level worlds") is false: social 15-21 build their own worlds (`box`, `dawn`, `noon`, all from `green(ECHO)`). The shared helpers are ~30 pure lines (`:37-66`), so a split is cheap. Fix: move them to `showcase_fixture.ts`, put social 15-21 in their own test file, drop the marker, and update the test-file cell of the two matrix rows and plan 3's pin line. Failure if left: the next plan that adds to Low Wardle hits the 750 cap and splits under pressure.
2. nit, `cartridges/toolbox_showcase/text.json` `narration.force_strongbox.success` ("a crack that carries into the road"): this announces at the act that someone heard, the same reason finding 4 rewrote `scene.letter_ash.2`. It could make the owner answer "I was told". Suggest a line that only describes the lock.
3. nit, `docs/showcase/cause-and-effect.md:155`: the weather note could add that each new save draws its own sky, so day 1 may be hot (overheated on the fell, not chilled).

## Disposition

- Record not pushed by the reviewer ([Git hygiene](../WORKFLOW.md#git-hygiene)): local branch `review-374`.

## Re-check at `23764d3671f54dc0147095a2fda159b15b1e83b8` (fix commits bb05b734, 23764d36)

- Hosted CI at head (per PM): ci, book-e2e, graph-diff green.
- Verdict: **APPROVE**. All three findings resolved; no new findings.

1. Finding 1, resolved. Social 15-21 now in `kernel/ts/test/showcase_consequence.test.ts`; shared helpers exported from `kernel/ts/test/showcase_fixture.ts`. Pure move: the old `showcase_social.test.ts` lines 391-end diff against the new file from `const ECHO` to end differ only by the dropped local `const DAY` (now imported). Every removed helper line reappears verbatim, with `export`, in the fixture. `size: allow` gone; social file 365 lines. Focused run: 22/22 (15 social + 7 consequence, as before the split).
   - Developer note (social 17, 18, 21 use `box`/`dawn`/`noon` from social 15 and 17): acceptable. The chain stays inside the one file, node:test runs a file's top-level tests in order, and it predates the split. Running one test alone by name would fail; not a spec requirement.
2. Finding 2, resolved. `narration.force_strongbox.success` is "The lock snaps."; the fixture's sha256(canonical) equals its `sha256` and the canonical holds the new line; `mix test test/loka/content_showcase_test.exs` passes (source compiles to the same bytes).
3. Finding 3, resolved. `docs/showcase/cause-and-effect.md:155-157` names the per-save sky and the hot-day case.
- Pins: `docs/SHOWCASE.md:54-55` and plan 3 "Pins the build writes" (`cause-and-effect.md:131`) now cite `showcase_consequence.test.ts`. Remaining `showcase_social.test.ts` cites are steps 1-14 or past review records.
- Local, head: both test files, `npm run typecheck` (kernel/ts), `mix test test/loka/content_showcase_test.exs`: all exit 0.
