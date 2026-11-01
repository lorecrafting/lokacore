# Review: dev-only go-to-room and set-fact, PR #546 (loka-vduxr.6, kernel_api 1.133)

- PR [#546](https://github.com/lorecrafting/lokacore/pull/546) `engine/dev-cheats` at `ee67c06338d9941f95e647b3f53deb7ea7854b48`, diff `origin/main...ee67c0633`.
- Governing: `br show loka-vduxr.6`; [cartridge.md](../system/cartridge.md#author-preview) Author preview; [mechanics.md](../system/mechanics.md) dev@1; [composition](../system/architecture.md#building-mechanics-by-composition).
- Reviewer: independent; authored none of the work.
- Verdict: **CHANGES REQUIRED** at `ee67c0633`: one blocker, two should-fix, two nits.

## Must be true (written before reading the diff)

1. A host without `dev` never decides a dev command; only the preview and `bin/loka check` set it.
2. `step` refuses dev commands; no authored action can build one.
3. The normal save and file are untouched by the preview.
4. Cheats are receipted commands a reopen and check re-decide under the same seed and clock.
5. An accepted cheat leaves every invariant holding, and the save reopens.
6. Adding `dev` widens no check for other capabilities or content.
7. What a release does with a save holding dev receipts is defined.

## Findings

1. **Blocker.** `kernel/ts/src/mechanics/dev/rule.ts:44-54` accepts a fact the load proofs demand a mechanic receipt for; the next reopen throws `save_corrupt` (`mobile/authority/local-story/topics-save.ts:19-25,38` `factProof`, `expedition-save.ts`, `session.ts:57-63`). Run, one cheat on a fresh game, reopen with `dev: true`: toolbox_showcase `flamma_known`, `topic_fire_known`, `topic_heir_known`, `topic_letter_known`, `topic_mill_known`, `topic_parish_known`, `topic_surety_known`, `topic_walker_known`; codex_sampler `topic_mill_known`, `topic_missing_cart_known`, `topic_smugglers_known`, `topic_wanderer_known`; expedition_sampler `night_survived`. Riddle and `perception.discovered` facts take the same path (code read). Scenario: the owner sets `topic_heir_known` in the preview and reloads; the save does not open, and a recording of that step does the same. `bin/loka check` should pass that checkpoint because it never reopens (code read, not run). Breaks must-be-true 5, the rule's header "Each refusal keeps a world invariant" and the slice's own reopen claim. Fix: refuse these facts in the rule (`reserved`), never weaken the load proofs; add a set-then-reopen test. Every other fact in the same sweep passed reopen, a 2 h advance and a second reopen.
2. **Should-fix.** `mobile/authority/local-story/receipt-history.ts:38` routes on the payload, not the host. Run: `openGame(db, bundle, host)` without `dev` on a dev save opens in the cheated room with the fact kept; a new cheat is refused `unsupported_capability`, `look` works. Tampering the dev receipt's value did throw `save_corrupt`, so a consistent dev receipt passes where a state change with no receipt fails: the dev route widens what a history-checked release admits. The ponytail comment's "any save without this history check also admits" does not cover the checked path. No real-player path today (separate file names, no import, `__DEV__` throw, metro refusal), only a hand copy. Fix: pass `host.dev` to `receiptHistory` and `invalid()` a `dev_` receipt without it; add the release-reopen test in `mobile/authority/local-story/__tests__/dev-cheats.test.ts`, which has none. Answer to the brief: a release can hold and replay one; it is never refused.
3. **Should-fix.** `kernel/ts/src/mechanics/dev/rule.ts:89` room event has no test. Mutant `[entered]` to `[]` leaves `dev.test.ts` and `dev-cheats.test.ts` green (22 pass). The event does matter: going to `sapper_cellar` fires reaction `cellar_springs`, `cellar_sprung` true, and it survives a reopen. Scenario: a refactor drops the event and go-to silently stops springing room reactions. Pin that in `kernel/ts/test/dev.test.ts`. PR body line 35 asks this question; the answer is keep the event, as the movement path does.
4. **Nit.** `mobile/authority/local-story/invocation.ts:174` prefix. No compiler refusal of an action key `dev_look` (`lib/loka/content/resolve.ex:443-445` checks command names only; the schema key pattern permits it, code read), so such an action works in a release and answers `unsupported_capability` in the preview (`dev_nope` observed on a dev host, same path). Safe direction; reopen routes on `payload.type`, so it stays safe. Fix: match the two names.
5. **Nit.** `bin/features.exs:64` accepts `no_transcript: ""`. Run: row without it gives `dev@1: missing transcript`, exit 1; empty string exits 0. Any implemented row can skip with no reason. Otherwise the exemption weakens nothing. Fix: refuse an empty reason.

## Brief questions, no finding

- `kernel/ts/src/commands/invocation.ts:96` malformed: `dev_nope` `unsupported_capability`; bad input type or actor `unknown_property`; `room: 'cellar'` invalid; foreign ref `not_found`. Loud and world unchanged.
- `mobile/app/author/place.ts:70` version bump: a recorded cheat is refused by name after a bump, as any recorded step holding a ref; loud. `place.ts:124` runs only behind the `place.ts:123` gate; that gate has a test (mutants below).
- `tools/author-panel/src/cheats.tsx:36`: no cartridge enum value in the tree parses as JSON (scan empty); no wrong type today.
- `rule.ts:69` no hp check: player death is atomic (`death/sequence.ts` transfers the body and restores hp), so no hp-0 player state persists to move (code read).
- Go-to invariants, run: every room across 13 fixtures from a fresh game, go-to, reopen, 2 h advance, reopen, all open. Built room: pending order on `build_sampler`, go to the yard accepted, lane refused as same room; elapse builds the hut; lane, yard and `built_<id>` accepted; reopen opens. Engaged, ride, dialogue, scene, water, patrol and expedition holds have tests. Transport holds no ongoing state (`transport/rule.ts`). Group hold is only reached through `travel`, not run for a group.
- `dev` capability: `lock.capabilities` row is a normal registry row, no other capability's check moves (finding 5 aside).
- App.tsx `dev: true` mutate-skip and no panel UI test: acceptable. The host-gate mutant turns `dev-cheats.test.ts` red, and the App line sits beside the `__DEV__` throw and the metro refusal.
- Composition: `heldInPlace` names combat, escort, expedition, position, scene (`rule.ts:17-35`) only to keep their invariants, which the slice requires; no mechanic names dev; the only content names are reserved key shapes. Accepted. No new op, save field or state.
- Fixtures: `protocol/fixtures/invalid.json` gains rows; live `.sql` stories re-pinned; nothing in `FROZEN` (`bin/regen.sh:37`). Tests follow "Writing tests" (literal expected values, breaks named).
- Over-engineering: nothing to delete beyond the second-hand `reserved` note the author already listed.
- Second opinion: not warranted unless the fix touches `topics-save.ts` or `expedition-save.ts`.

## Test the tests

`MUTATE_MINUTES=8 bin/mutate_diff.sh origin/main`: header `73 mutants (34 run)`, but every printed row is TIMEBOX (68) or NOT-UNIQUE (5): no kill or survivor recorded, so the rows count as unrun and the run backs nothing. So the handback's `bin/mutate.sh` rows (3 at this head, 27 earlier) were sampled by hand instead.

Further hand mutants at this head: same-room check dropped, red "go to room refuses an unknown room and the same room"; no-op fact check dropped, red "set fact stores the value"; `step` refusal of `dev_` dropped (`world.ts:133`), red "the ordinary step refuses both cheats"; `sendCheat` gate dropped (`place.ts:123`), red "a cheat waits for the time due and is not sent while it is undelivered" (null 17 pass).

Hand mutants (dev.test + dev-cheats; null 22 pass): host gate forced true, red "a host without dev refuses both cheats"; history route to `step`, red "a dev host decides both cheats and a reopen holds them"; room event dropped, **green** (finding 3); travel hold dropped, red "refuses while riding"; scene hold dropped, red "in a modal scene"; owned-fact catch false, red "set fact refuses unknown". `kernel/ts/test/check.test.ts` was baseline red in the unset-up probe tree, so it was left out of these.

PR claims rerun: "every other `heldInPlace` term, `host.dev` gate" red, backed for the terms and gate sampled above; "no cartridge action can name them" backed for command names at `lib/loka/content/resolve.ex:445`, not for key prefixes (finding 4); "history check runs only on exchange/liquid paths" confirmed (`exchange-save.ts:27`, `liquid-save.ts:30`). `/code-review medium` reported for `99b9016fc..689cb11ff`; the later three commits were not in it.

Not run: a random walker (go-to from fresh and selected states only); `dev_look` compile.

CI at `ee67c0633`: graph-diff, book-e2e, ci completed success.

Verdict: **CHANGES REQUIRED**.
