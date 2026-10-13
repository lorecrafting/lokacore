# Review: toolbox row 32, fast travel (loka-kgd.120)

- Branch `toolbox/m10-fast-travel`, head `7b9c4ba314a83366ae59c516259eb51e2bbe1ee6`, diffed against `b6156e83` (`toolbox/batch-m10`). No PR and no hosted CI (pushing blocked). No `kernel_api` change (content only).
- Governing: [Fast travel](../system/mechanics.md#fast-travel-toolbox-row-32) (added here), [D1 paid ferry](../system/mechanics.md#d1-paid-ferry-and-sedge-lesson-selected-contract), the `visited_count` leaf bullet in [mechanics.md](../system/mechanics.md), [D1 ferry and Isle declarations](../system/cartridge.md#d1-ferry-and-isle-declarations), Beads `loka-kgd.120` (brief). PM rulings (not findings): `recovery_rooms` names the destination post, reusing D1's waiver; the toolbox table edit is the PM's at batch close; no `kernel_api` change.
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; three nits).
- Written 2026-10-13 18:24 UTC by claude-opus-5-5 (reviewer).

## Must be true

1. The gate is the route action's `policy` `visited_count {room: <destination>, at_least: 1}`; transport admission (`actions.ts` `refusal`) and the GameView offer (`view/transports.ts`) both read it; the departure post has no gate.
2. A route's action is bound by the route (`boundAction`), so an unkeyed or mis-keyed `use_transport` cannot borrow the other route's policy.
3. The trip is the D1 transition: fare to the recipient, body transfer, entry event; the clock does not move.
4. Content declares `transport@1`, `knowledge@1` (else nothing is recorded, VISITS_UNRECORDED), `variety@1`, `kernel_api` at least 1.45; posts share no exit; calendar start is not 0 (the hp row exists).
5. No change to `kernel/ts/src`, `lib/`, `protocol/`, schema or loader; spec sections sit between D1 and B8 (mechanics) and at the end of D1 declarations (cartridge).

## Proof

- Diff: 11 sampler files, one test, two spec hunks, two regenerated `.gen.json` (semantic diff: row-32 `section` anchor plus the new file paths). No source change.
- Green at head: `node --test` fast_travel, transport, transport_contracts (10/10); `elixir bin/contracts.exs --check`, `node bin/check_ts_size.mjs`, `elixir bin/check_size.exs`, prettier on changed `.ts`/`.json`: all exit 0.
- Mutants (fast_travel.test.ts only, each restored, `git status` clean): all six killed. `ride_south` `at_least` 2 (ride test fails); `knowledge` dropped (warning test and ride test fail); `north_road` fare 4 (ride test); `refusal` policy bypassed for `use_transport` (unvisited test); `boundRoute` stale-quote check removed (ride test); `visited_count` `>=` to `>` (ride test). Dropping `containment` fails the load (UNDECLARED_CAPABILITY, npc owner), so it is needed.
- Keyed admission probe (fresh world, temporary test, deleted): unkeyed `north_road` gives `invalid_state`; keyed `ride_north` on `north_road` gives `unsupported_capability`; the offer's `action_key` is `ride_south`, `available: false`, reason `invalid_state`.
- Literals hand-checked: 10, then 7/3, then 4/6; purse 2 is below fare 3; clock C0 = 28800.

## Findings

1. **nit** `cartridges/fast_travel_sampler/text.json:16`: `transport.unaffordable` is one cartridge-wide key but says "three coins". The spec says fares are per route (`mechanics.md:1433`). Scenario: an author copies the sampler and sets `north_road` fare 4. A broke player is then told "three coins" for a 4-coin ride. Fix: drop the number ("You cannot pay the carter's fare.").
2. **nit** branch history: the first commit is `7938460 WIP: ... (paused at API limit)`, and the spec is the second commit. The brief asks for "SPEC FIRST (same branch, first commit)". Scenario: a batch merge that keeps the history lands a WIP commit whose message says nothing about its content. Fix: reword or reorder the commits before the batch merge (PM's call).
3. **nit** no PR body exists, so there is no `/code-review` result to check, and no claims could be rerun. Open item for the batch PR.
