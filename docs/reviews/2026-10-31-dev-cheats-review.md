# Review: dev-only go-to-room and set-fact, PR #546 (loka-vduxr.6, kernel_api 1.133)

- PR [#546](https://github.com/lorecrafting/lokacore/pull/546) `engine/dev-cheats` at `ee67c06338d9941f95e647b3f53deb7ea7854b48`, diff `origin/main...ee67c0633`.
- Governing: `br show loka-vduxr.6`; [cartridge.md](../system/cartridge.md#author-preview) Author preview; [mechanics.md](../system/mechanics.md) dev@1; [composition](../system/architecture.md#building-mechanics-by-composition).
- Reviewer: independent; authored none of the work.
- Verdict: **APPROVE WITH NOTES** at `8695092c2` (final re-check below); first review **CHANGES REQUIRED** at `ee67c0633`: one blocker, two should-fix, two nits.

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

## Re-check of the fix commits at `393cbc928d854fb7d46d30d63e261fdc121cd93c`

Scope: `git diff 49d8a0395 393cbc928` (`a0aadbde8`, `393cbc928`) and direct callers. New reviewer; the first reviewer's context is gone. PM rulings in loka-vduxr.17 not reopened; no wrong result on a real save found against them.

Verdict: **CHANGES REQUIRED**: two should-fix needing logic changes (a fix round per [WORKFLOW](../WORKFLOW.md#small-should-fix)), two nits.

### Dispositions

| First-review finding | State | Proof |
|---|---|---|
| 1 blocker `rule.ts` proof facts | fixed on open | Sweep below: no `save_corrupt` at reopen. A new path, finding R1 |
| 2 should-fix release opens a dev save | fixed | `receipt-save.ts:18-32` refuses; mutant `!dev` dropped: 2 red. A save holding only a refused cheat still opens on release (run, 3 fixtures) |
| 3 should-fix room event untested | fixed | Mutant `[entered]` to `[]`: red "go to room announces the entry" |
| 4 nit prefix | fixed | `invocation.ts:174` two names; mutant one name: 4 red |
| 5 nit empty `no_transcript` | fixed | Planted `""` on `dev@1`: "missing transcript"; null clean |

### Findings

R1. **Should-fix.** `mobile/authority/local-story/save.ts:111` `adopt` calls `load` without `s.host.dev`, so the new gate reads a dev save as corrupt. Callers: `save.ts:67` and `elapsed.ts:46` run only in the fence after an unknown COMMIT (code read), so this needs a fault, not ordinary play; `authority.ts:261` runs on every new game, but a new run holds no cheat receipt. Run on toolbox_showcase with `sqliteHost`, dev host: a cheat whose COMMIT acknowledgement is lost answers `pending`, its retry answers `save_corrupt`, the session stays in the old room; a reopen opens at `boar_run`. Same with a prior cheat. Scenario: any lost-ack step in the preview blocks the session with a corrupt-save message on a healthy file until reload. Control: passing `s.host.dev` there, the retry answers `saved` `replay: true` and the view moves. Fix: pass it, add that test. Reload heals it and the in-session error offers no new reset (only the Book's usual confirmed Start over; `SaveError` shows only at open), hence not a blocker.

R2. **Should-fix.** `kernel/ts/src/mechanics/dev/rule.ts:46-47` refuses `fact.assign` targets of every `receive`/`hand_over` choice, but `dialogue-save.ts:155-161` proves them only for an escort choice or a custody-start item; the `rule.ts:39` comment is wrong for these. Run across all 107 compiled `cartridges/`: with the proof list bypassed, set then dev reopen opens for `search_plan` (cellar, chapters, ferry, journal, lantern_proof, scene samplers: a plain enum branch set by Bram's choices) and `inn_cellar_cleared`; refused `invalid_state` at this head. Scenario: a writer cannot jump to the `party_led` branch of `search_plan`, though the fact is safe, and any future "handed it over" fact is refused the same way. `checkAssignments` compares against a set fixed by the cartridge, so fresh-state passing holds for played states too (code read). Fix: narrow to `c.escort` and custody-start items; adjust the "and only those" cases at `kernel/ts/test/dev.test.ts:209-210`. Likewise `q.expedition.faction` at `rule.ts:55`: `wild_standing` reopens on a fresh game with the bypass, and `expedition-save.ts` tracks it through receipts (code read); played state not run, so drop it only with a played set-then-reopen. Control: the same bypass keeps the 17 topic facts and `night_survived` at `save_corrupt`, so the refusal is needed there.

R3. **Nit.** `mobile/authority/local-story/receipt-save.ts:22` mutant `='accepted'` to `1=1` stays green (29 pass), so "a save with a refused cheat still opens" has no pin. Scenario: the filter is dropped and a preview save copied to a release is refused for a cheat that changed nothing.

R4. **Nit.** PR #546 body: "Accepted, open" still lists `receipt-history.ts:36` and `invocation.ts:174` as they were, "`dev.test.ts`: 20 pass" is now 22, and `/code-review` stops at `689cb11ff`. Update it in the fix round.

### Set-then-reopen

Every fact of all 107 compiled cartridges, fresh game, one cheat, dev reopen, real SQLite: 125 plain facts accepted and reopen; refused: 26 proof facts, 167 by ownership, subjectivity, `position` or scene rules. No `save_corrupt`. Outside the fix, no finding: `green_sampler` `bell_up` answers `fault` `budget_exceeded` (the cartridge's reaction cycle), reopen opens; `hello_sampler` `village_arrived` throws at open, not traced. Frozen fixtures `cartridge_sampler` and `sampler_v009` are `save_corrupt` with no cheat at all, so they are not evidence.

Played states: not walked. Every proof that reads a fact was read instead (`value`/`factDefaults` in `topics-save`, `dialogue-save`, `expedition-save`, `deadline-save`, `deadline-receipts`, `skills-save`): each read is on the refused list or owned by `fact.ts ownership`, except the deadline axis at `deadline-receipts.ts:40-43`, reachable only for `deadline.fact`, which no compiled cartridge has. Question for later content, no failure today.

### Mutants

`dev.test.ts` + `dev-cheats.test.ts`, null 29 pass. Red: `!dev` gate (2), `host.dev` at `authority.ts:102` (4), topics clause (2), deadline clause, trust only, escort, receive, hand_over, riddle, perception, faction (1 each, kernel test only), entry event, one action name (4). Green: R3. Deadline, escort and riddle clauses have no real-save pin, as the brief notes; no cartridge reaches them at this head.

PR claims rerun: "`test/dev.test.ts`: 20 pass": now 22, R4. "`invocation.ts:96` malformed cheat answers `unsupported_capability`": line is `resolveDev`, first-review run stands. `/code-review` reported for `99b9016fc..689cb11ff` only, R4.

CI at `393cbc928`: graph-diff, ci, book-e2e completed success.

Not run: `bin/mutate_diff.sh` (the brief asked for narrow mutants); go-to-room sweep (fix did not touch it; first review ran it).

## Final re-check at `8695092c2a543caa046704149f3aad4e9a287507`

Scope: `b51d918eb`, `1f6a8fcb3`, `8695092c2` and three items from the developer's self-review. Verdict **APPROVE WITH NOTES** for this exact head only; a rebase needs the list below. CI at this head per `gh run list --commit`: graph-diff, ci, book-e2e completed success.

### Dispositions

| Item | State | Proof |
| --- | --- | --- |
| Lost-ack retry, `save.ts:111` | Fixed | Fault probe: `dev_set_fact`, lost COMMIT answers `pending`; retry `saved`, replay, accepted; dev reopen opens; release open `save_corrupt` |
| `rule.ts:46` custody targets only | Fixed | Reads the same as `dialogue-save.ts` `custodyStarts` and `checkAssignments`. Sweep: `search_plan` (6 cartridges) and `inn_cellar_cleared` accepted, reopen OK |
| `wild_standing` refused | Accepted | Sweep: `invalid_state`, reopen OK |
| `receipt-save.ts:22` accepted only | Fixed | Rejected extras on a release host, then a clean move: reopen opens at the same place |
| PR body | Fixed | Reran `dev.test.ts`: 22 pass; `dev-cheats` + `place`: 27 pass. Cite `run.ts:75` is the `dev_` branch |
| Absent `trust_fact`, `rule.ts:73` | Fixed | Mutant back to `!` goes red |

Sweep: every fact of 107 compiled cartridges, fresh game, one cheat, dev reopen: 131 accepted, 187 `invalid_state`, one `fault`, no `save_corrupt`. `hello_sampler` `village_arrived` still throws at open, untraced, as in the previous round; `green_sampler` `bell_up` is the `fault`.

### Self-review items

- `mobile/app/author/place.ts:110`: **nit**. A `pending` reply reads "Go to room refused: pending." though the COMMIT may have landed. Failure: on a lost ack only, dev panel only; the retry replays correctly. Belongs in loka-vduxr.17.
- `kernel/ts/src/runtime/world.ts:189`: **none**. `stepDev` skips the lock-capability check `stepElapsed` makes. No cartridge locks dev (`toolbox_showcase` has no `dev` in its lock, cheat accepted on a dev host), so the check would break the cheat. Callers: `invocation.ts:182` behind `host.dev`, `receipt-history.ts:37` behind the release gate, `play/run.ts:76`. No release path.
- `protocol/action.schema.json:47`: **none**, one behaviour note. Run on a release host: `move` with extra `room`, or `fact` and `value`, and `dev_go_to_room`, `dev_set_fact`, each answer `saved`, rejected `unsupported_capability`, revision and place unchanged, one receipt row added. Before this PR the same extras would fail shape validation with no row (from the schema; main not run). A hand-built invocation only, same as `topic` or `word` today; no offered action sends them. Unknown keys still answer `invalid` with no row.

### Mutants

Null: `dev.test.ts` 22 pass, `dev-cheats.test.ts` 10 pass. Each goes red: adopt without `dev`; `1=1` for accepted in `DEV_RECEIPT`; custody term `false`; `give_allowed` check `true`; `d.quest` check `false`; `trust_fact` `!`; `c.receive` without `hand_over`.

Not run: `bin/mutate_diff.sh`, full suites, book UI. A first mutant shell hung on my own stray `cat`, no mutant applied; stopped by PID, rerun.

### Second opinion

Required: `docs/WORKFLOW.md` Review count, the PR changes a protocol schema and save checks. Run it on the rebased head so it covers the trimmed rule.

### Re-check after rebasing on #544

1. `#544` deletes `topics-save.ts` and its `dialogue-save.ts` no longer infers who wrote a fact, so `rule.ts:43-80` refuses facts that nothing proves. Each kept term needs a live reopen proof on the rebased tree; topic and dialogue custody terms and `held`, `custody` should go unless one remains. Expedition, deadline, riddle and perception terms: check each against its save file.
2. Rerun the set-then-reopen sweep: no `save_corrupt`, and every newly accepted fact reopens. A term cut too far shows as `save_corrupt`; one left in shows as a refusal with no proof behind it.
3. Tests that pin the custody refusal in `dev.test.ts` must change with the rule; rerun narrow mutants on what remains.
4. `#544`'s new dialogue reopen path keeps the `dev` flag; `receipt-history.ts` gate still refuses an accepted cheat on release.
5. `ActionInput` and `kernel_api` (now 1.133 here, 1.135 taken by #550, #544 next), capability lock and frozen fixture regenerated, not hand-merged.
