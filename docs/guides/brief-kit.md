# Brief kit

Every slice brief links this file and does not copy it ([PM step 2](../PM.md#loop)).
The developer reads it once. A brief adds only the slice's own rules.

## Common rules

Rules (read once): `AGENTS.md` Simplicity and Writing tests; `.claude/agents/developer.md`;
`docs/lessons/mechanics.md` and `contracts.md` (a schema change gets the schema mutant sweep before
handoff); [building mechanics by composition](../system/architecture.md#building-mechanics-by-composition);
`docs/MECHANICS-TOOLBOX.md#traps`.
- Loader refusals: run every existing test a new refusal could hit
  (`kernel/ts/test/loader_floors.test.ts`, `test/loka/loader_floors_test.exs`, every test that
  compiles a sampler, `elapsed-host.test.ts` coldReopen). One invalid row per kernel, with a red
  control for every new check.
- Floors: a new floor or gated feature whose cartridge carries no other feature at that floor gets a
  `protocol/fixtures/loader_floors.json` case (strip the other features by edits), with a red control
  in both kernels. After a merge that adds a feature to a shared sampler, rerun the other floor
  cases' mutants of that sampler.
- View tests: validate `gameView(w)` against `protocol/gameview.schema.json` (an empty `choices` or a
  price 0 must fail the schema, not pass the test).
- Sampler hash: a change to a sampler with transcripts (`cartridges/*/transcripts`) updates its
  `protocol/fixtures/*_sampler_hash.json` known answer and the fixture list in the
  `mobile/app/stories/SystemDataModel.stories.tsx` Impact story.
- Exact boundary: test every threshold at the boundary value and one past it.
- Content: hand back an item loop table (item: source -> sink or cap); no hidden faucet.
- Mutants: `bin/mutate_diff.sh origin/main` mutates every added conditional; the check table is its
  output (a SURVIVED or NO-TESTS row needs a test, or a `mutate-skip: <reason>` on a non-logic line).
- Self-review: `/code-review medium <branch-name>` (the slice branch, e.g. `feat/x`); never with no
  target (a `cd` does not change a skill's target). Name the range; a review that lists files outside the slice
  is void.
- Push: `bin/push_slice.sh <slice worktree> <branch>`; read its `PUSH_EXIT=<n> <sha>` line and
  whether `ci` and `book-e2e` started; never wait on CI.
- Screenshot: when the player sees the change, a 390 px screenshot of the web Book
  ([web preview](../web-preview.md)); its path goes in the handback.
- Never print home or worktree absolute paths in commits, Beads text or PR text.

## Handback

Under 250 words: head sha; check table; `/code-review medium` result (range named); Realm answers;
open questions (the PM rules on them as follow-ups); COST (your token count).

## Realm checklist

Answer each item "met: how" or "n/a: why". Source:
[Realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md). This row adds no new
single-player assumption.
1. Actor: rules read the command's actor (`bodyOf(world, actor)`); jobs store their character; no new
   `world.character` outside `runtime/`, `view/`, local authority.
2. Reactions: each new trigger or step names its actor from the event's declared subject, never the
   listener default.
3. Credit: a shared payout names its credited character (encounter, G8 member) and states its credit
   rule in one line.
4. Time: no device clock; delays in logical units; no skip; no from/until outside the elapsed path.
5. Scope: per-player facts are player scope (instance only for world state); a once-per-world spawn
   or event states its Realm audience.
6. Text: `speech@1` unchanged; typed text visible only to its writer; anything shared names
   `speech@2` (Realm).
7. Ownership: exclusive or not, and how it moves; theft never transfers ownership.
8. Trust: no receipt or import trusted that this authority did not compute; a row that needs it
   lands `result_digest` first.
9. Instancing: none built, none assumed; a unique thing states shared-world or per-instance.
