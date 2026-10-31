# Review: Map unexplored exit stubs, PR #524 (loka-6bmd, kernel_api 1.127)

- PR [#524](https://github.com/lorecrafting/lokacore/pull/524) `feat/6bmd-map-stubs` at `521d9ed4f6b548a44b7ed847cb06ee75e80c5a76`, diff `origin/main...521d9ed4f` (main at `03395556a`).
- Governing: `br show loka-6bmd` (owner quote 2026-10-30; Book half loka-wz6f); [D10](../system/mechanics.md#d10-discovered-places-observations-and-knock-selected-contract) ("shows a connection only when both ends are visited"); hidden face (mechanics.md toolbox row 11, `hidden` in `kernel/ts/src/mechanics/lookups.ts:49`); [protocol.md](../system/protocol.md) D10 GameView paragraph; [cartridge.md:22](../system/cartridge.md) (a contract bump never moves a cartridge `at_least`); [save.md](../system/save.md#opening-a-story) (pin carries kernel_api, #519); AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **CHANGES REQUIRED** (one blocker, one nit, one question).

## Must be true (written before reading the diff)

1. Stubs come only from rooms this actor visited; one per seen exit whose destination this actor has not visited; direction plus a stable id; no destination id, title, coordinates or hidden fact.
2. An exit to a visited room is a link, never a stub; another actor's visits do not count.
3. A hidden face (`hidden_until` unmet for this actor) yields no stub, through the same `hidden` rule `sight` and the links use, not a copy of it.
4. Remote stubs carry no live Move availability.
5. kernel_api bumped only in `world.ts`, strictly above main's 1.126 and every open PR's; no cartridge `at_least` moves.
6. A save pinned to an older kernel_api is refused at its pin; checked-in saves repinned.
7. Schema, generated contracts, protocol.md and GameView validate together.

Results: 1 (behaviour holds; tests do not hold it, finding 1), 2-7 hold. Open PRs #523 and #454 bump no kernel_api. The map is TypeScript-only (no Elixir MapView).

## Findings

1. **Blocker, `kernel/ts/src/view/knowledge.ts:59`** (requirement 1; reviewer.md step 3, a green suite on core logic). Hand mutant `rooms.flatMap(({ id }) =>` -> `[...at.keys()].flatMap((id) =>` (scan every placed room, not only visited ones) SURVIVED `d10_presentation`, `showcase_world` and `hidden_passage` together. On a fresh showcase world it gives 111 stubs (6 at the head) and 6 links from unvisited rooms (0 at the head): every unvisited room's exit directions leak onto the map. `showcase_world.test.ts:72` filters stubs by `from`; the `d10_presentation` fixture's placed unvisited rooms have no exits. Fix: one assertion that kills it, for example every `unexplored[].from` (and `links[].from`) is in `map.rooms`, or an exit on the shaft in `d10_presentation.test.ts:103` with its exact `deepEqual`.
2. **Nit, `kernel/ts/src/view/knowledge.ts:63`.** The scan uses the shared `hidden`, but restates `sight`'s `shown` (`movement/rule.ts:52`, exit present and not hidden). Failure: a visibility rule later added to `shown` (the rule.ts:44 ponytail names perception) hides an exit from Exits while the map still stubs it. Optional: one exported `shown(world, room, direction, actor)` both call.
3. **Question for the PM** (the developer's open `/code-review` item). Stubs, like links, read live exits of remote rooms; a non-player-scoped `hidden_until` fact or a room built at a visited site by someone else would show a stub the actor never saw. Not reachable today: `stair_found` and `panel_found` are `player`-scoped and set only by the actor's own search. Non-blocking.

## Test the tests

- `bin/mutate_diff.sh origin/main` at the head: 2/2 red-narrow (`knowledge.ts:63` `&&->||` x2), matching the handback.
- Hand: drop the `actor_id` filter on visits: red (`d10_presentation`); stubs keep visited destinations: red; stubs ignore `hidden`: red; scan unvisited origins: SURVIVED (finding 1).
- Claim reruns: "drop unexplored from MapView.required ... red" (contracts.gen.ts): red, 1 fail in `d10_contracts`; "other-actor-visited room is a stub": backed by the actor-filter mutant above.
- Not run: `release_pin.test.ts` (no mobile deps in the scratch tree); its check is `saved.pin.kernel_api !== INSTALLED.kernel_api` (`authority.ts:98`), version-agnostic.

CI on `521d9ed4f`: graph-diff success; ci and book-e2e in_progress (one `gh run list --commit`).
`/code-review medium` reported in the PR body.
