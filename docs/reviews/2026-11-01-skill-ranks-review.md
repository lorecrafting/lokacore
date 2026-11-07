# Review: skill ranks, PR #570 (loka-g5hh.2.3)

- PR [#570](https://github.com/lorecrafting/lokacore/pull/570) `engine/skill-ranks` at `d59015447655629fc7ebcccb4794e7e10ee25c07`.
- Governing: [mechanics.md Skill ranks](../system/mechanics.md#skill-ranks-level-up-rush), [cartridge.md](../system/cartridge.md), [storage.md reopen principle](../lessons/storage.md), Beads notes of `loka-g5hh.2`.
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); ten targeted mutants below.

**Verdict: APPROVE WITH NOTES.** No blocker or should-fix. Three notes below, one a merge-order item.

## Must be true (written before the diff)

1. `rank` is `ranks[level - 1]`, read through the same `level` the mechanics use; none at level 0.
2. A concealed skill is absent from the view entirely, its rank and line with it.
3. `learned` is on the view whenever declared; the key is not a telling.
4. A cartridge without the fields keeps its view and hash.
5. The compiler refuses a wrong count, ranks without growth and unresolved texts.
6. An artifact past the compiler with a wrong count does not make the view throw (reopen principle).
7. No engine-told line: no new event or delta.
8. `kernel_api` is main + 1; every string is an authored key or a neutral placeholder.

## Evidence

| Check | Result |
|---|---|
| 1. Sweep taught and untaught, uses 0 to 5, against `level` | Equal everywhere; untaught 0 has no rank; untaught 5 is rank 5, taught 5 is rank 6; `validate('GameView')` empty |
| 2. Hidden, failing prerequisite, uses 0, 3, 5 | Untaught: no entry and no key in the view JSON. Taught: shown, per hs-14 |
| 4. All 107 cartridges compiled at main d7407bb8d and head | Only `skills_sampler` hash differs |
| 5. Compiler attacks: ranks string, null, map, empty, ints; stray key; bad name, reached, learned | Each a diagnostic, no crash |
| 6. Loader: short, empty, no-growth artifacts with a correct hash | Load (semantics are the compiler's). In memory plus long: view does not throw and validates; the rank is absent past the end, or surplus entries unused |
| 6. Loader: `ranks` a string, stray rank key | Refused, SCHEMA_VIOLATION and UNKNOWN_FIELD |
| 7. `kernel/ts` readers of `ranks` | Only `view/skills.ts:55`; no presenter reads the fields yet (PR cite `mechanics.md:3671`, confirmed by grep) |
| 8. Story SQLs | Seven differ, each only by the `kernel_api` line |
| PR claims rerun | Hash claim; `no file under protocol/fixtures changed`; cites `view/skills.ts:55`, `cartridge.schema.json:2133` |

Wrong-count artifact, developer's risk: acceptable. It loses a name and never throws, so the reopen principle has nothing to refuse.

Mutants (`bin/mutate.sh`, narrow file): `ranks[at]`, `Math.max(at - 1, 0)`, `learned` gated on acquired, `reached` dropped, count `>=`, count without `+ 1`, growth check dropped, ranks out of `text_refs`, `learned` out of `text_refs`: all red. Dropping the concealed return survived the narrow file and is red in `showcase_homestead.test.ts` (existing cover).

Tests: expected values hand-written, no frozen fixture touched, no mock. Over-engineering: none found. Prose: `Learned line.`, `Rank N`, `Rank 2 line.`, `Rank 5 line.` in the sampler only.

## Findings

No blocker or should-fix.

Notes:

1. Merge order: `kernel/ts/src/runtime/world.ts:110`. Main is 1.143 and #570, #557, #569 all claim 1.144. Whichever merges later must rebump and regenerate, or the pin collides.
2. For B1, no schema change needed: was and now views carry `acquired`, `level`, `learned`, `rank.reached`. But `mobile/app/book/received.ts` `skillEvents` returns early on a teach, so `ranks[0].reached` is dropped unless B1 decides; its `w?.acquired` guard silences every rise of an untaught skill, which is all of sampler `pick`. Lifting it to `w?.level ?? 0` makes a newly unconcealed practised skill speak a spurious line.
3. For B1, by reading, not run: a dialogue choice with an opposed check on a skill plus `skill.acquire` can raise the level by 2 in one reply, skipping an intermediate `reached`, since the view holds only the current rank.
