# Review: sanctuary refusal, PR #577 (loka-g5hh.2.9)

- PR [#577](https://github.com/lorecrafting/lokacore/pull/577) `engine/sanctuary-refusal` at `fd4a711e1e42fcca16f52661d5caafb1385aa3e6`.
- Governing: [book-ui.md Unavailable actions](../system/book-ui.md#unavailable-actions), [level-rush rulings S1](../design/level-rush-rulings.md#s1-sanctuary-refusal), [protocol.md](../system/protocol.md).
- Reviewer: independent; authored none of the work. This pass also covers the contract (`protocol/error.schema.json`).
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); targeted mutants below.

**Verdict: CHANGES REQUIRED.** Three blockers, two should-fixes. The refusal itself and the contract are right; the card's words are not.

## Must be true (written before the diff)

1. On an attackable NPC's page in a sanctuary, sitting or standing, Attack is grey with one authored sentence (`combat.sanctuary`).
2. No card on an unattackable, ally or hp-less NPC.
3. A press changes nothing in the world; the sentence is its hint and its logged refusal.
4. Outside a sanctuary, engaged or seated refusals are unchanged.
5. The card stays focusable and pressable, with the reason as its hint and a readable label as its name.
6. A raw text key never reaches a player.
7. `GameError` is additive; schema, generated TS and Elixir agree; `kernel_api` is main + 1.
8. Only `containers_cartridge_sampler_hash.json` changes; no player prose beyond a placeholder.

## Findings

### Blocker 1: the grey card reads `action.attack`

`mobile/app/book/sanctuary.tsx:12` passes `text(a.label)`. Production wiring: `NpcDetail` passes `screen.text` (`Npc.tsx:301`), which is `sayers(game).text` (`presenter.ts:282`). Live at merge: `cellar_sampler`, the only cartridge with a sanctuary, has no `action.attack`. `text` returns the key on a miss (`mobile/app/book/words.ts:21`) and no cartridge's `text.json` has `action.attack` (grep: 0). Failure: run through the real presenter and sayers, the visible label and the accessible name are `action.attack`. Ordinary buttons use the `label` resolver (`words.ts:22`), which gives "Attack". The test stub returns keys and asserts only the hint (`pass1_ui4.test.ts:245`); `NpcAttack.stories.tsx` supplies the word, hiding it. Fix: resolve through `label` (a new `NpcProps` member, passed where `text` is) and assert "Attack" with the real `sayers`.

### Blocker 2: a missing `combat.sanctuary` shows the raw key (ruling on the PR's open question)

Latent at merge: every cartridge in `cartridges/` with a sanctuary (only `cellar_sampler`, scanned for `"sanctuary": true`) has the key, so the scenario is a future cartridge; it stays a blocker because a raw key must never reach a player. Probe with no key: hint "You can't do that—combat.sanctuary.", log "combat.sanctuary". **Ruling: a neutral runtime fallback, not a compile warning.** A warning does not stop shipping, so it does not protect the player, and it breaks `{:ok, actual, []}` at `test/loka/content_reward_storage_test.exs:111`. Smallest fix: in `why` (`words.ts:287`) and the log answer (`words.ts:92`, `:234`), a sanctuary message whose key does not resolve falls to `LABEL.notHere`, which already yields "You can't do that here." (`reasons.ts:11`). No new prose. Test both places.

### Blocker 3: the order of cannot-be-hurt and sanctuary is untested

Mutant K1 (hp check moved after the sanctuary check, `kernel/ts/src/mechanics/combat/shared.ts:45`) stays green on combat, d9_suppression, fear, spell_effects, standing and cartridge_sampler tests. Failure it allows: an hp-less person in a sanctuary gets a grey Attack, against must-be-true 2. One assertion in the sanctuary test closes it.

### Should-fix 1: pressing the card logs nothing

`actions.tsx:125-160` sends nothing and writes no line; `book-ui.md:742` says so; `book-ui.md:231` and the rulings (`level-rush-rulings.md:137`) say "logged refusal". Only a stale or raw engine reply logs (`words.ts` `replyLine`); the test titled "in the log" exercises that route alone. Failure: a player presses grey Attack and the log is unchanged. The PM decides: log the press and amend :742, or reword :231 and the rulings to the engine route.

### Should-fix 2: nothing tells the writer the line's shape

`reasons.ts:15` frames a line not opening A-Z. Probes: `a quiet rule holds here.` and `“Not here,” the stone says.` read "You can't do that—…" on the card and unframed in the log; `Not in this room` gains a stop on the card, none in the log. `docs/system/cartridge.md` and the compiler do not state it. An opening quote or accented capital is plausible owner prose. Smallest fix: the sanctuary card shows its resolved sentence unframed, as the log does, so no rule is needed; else one clause in `cartridge.md`.

### Nit

`Npc.tsx:206`: dropping grey for hostile NPCs (mutant B1) survives; no test draws a hostile in a sanctuary. A nit, not a blocker like K1: B1 invents a condition the code does not have, and every NPC takes the same line, while K1 reorders logic that exists.

## Evidence

| Check | Result |
|---|---|
| Plain NPC in sanctuary | offered unavailable, cause `sanctuary`, message key |
| Unattackable; hp-less; ally (real ref) | no offer `invalid_target`; `cannot_be_hurt`, hidden; no offer `invalid_target` |
| K2 seated escapes the check | killed: "a sanctuary refuses Attack ..." |
| B2 reason unresolved; B3 log fallback | killed: "an Attack in a sanctuary is grey ..." |
| K1; B1 | survive (above) |
| PR claim: kernel without `message` | backed, named test fails |
| PR claim: `sanctuary` in `HIDDEN` | backed, "an unavailable card hides ..." fails |
| A11y | `refusedProps(hint)`, Pressable not disabled, hint tested; the name is finding 1 |
| Contract | `message` optional, `sanctuary` appended, `additionalProperties: false` kept; `contracts.gen.ts` matches; `elixir bin/contracts.exs --check` exit 0; Elixir has no refusal logic, schema-driven |
| Fixtures | only `containers_cartridge_sampler_hash.json`; live story SQL changes are 1.148 to 1.149 only |
| `kernel_api` | 1.149, origin/main 1.148 |
| Prose | placeholder only |

Not checked: a validation fixture for `GameError.message` (existing tests validate GameView only); screenshots; full mutate sweep.
