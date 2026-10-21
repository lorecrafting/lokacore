# Review: PR #419 opt-in observed line for a status on a seen NPC, kernel_api 1.110 (loka-kgd.176)

- PR [#419](https://github.com/lorecrafting/lokacore/pull/419), branch `fix/npc-status-line`, exact head `c73751ddcce8bd95e6b61390fae7d6c198948600`, base `origin/main`.
- Governing: [mechanics.md G3 Narration](../system/mechanics.md) (status@1); [cartridge.md status declarations](../system/cartridge.md) (line 1784); [owner decision 2026-10-21](../decisions/owner-decision-npc-status-line-2026-10-21.md); [contracts lessons](../lessons/contracts.md); [mechanics lessons](../lessons/mechanics.md).
- Hosted CI at the head when written: `graph-diff` success; `ci` and `book-e2e` were still in progress at commit time (PM checks before merge).
- Written 2026-10-21 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. Without `narration.observed`, behaviour is unchanged: NPC and item holders stay silent; the player's applied, tick and expired lines do not change.
2. `observed` is said only on a first application to an NPC in the actor's body's room that the actor sees (light `visible`: blind, concealment, dark room), and only on the acting character's receipt. A refresh says nothing.
3. Both loaders refuse `observed` below 1.110 and refuse an unknown text key the same way, with a floor case and a red control in each kernel.
4. The schema field is a bounded TextKey, with an invalid fixture row.
5. G3 and the decision record are amended to match.

Holds: 1-5. For 3, the unknown-key refusal is the generic narration-text rule; its existing red controls are `kernel/ts/test/status.test.ts:378` and `test/loka/content_status_test.exs:15` (any key, the check is not per key).

## Checks

- Unknown `observed` key gives SCHEMA_VIOLATION at `narration`, not UNRESOLVED_REFERENCE: this is the existing generic narration rule in both kernels (`cartridge_status.ts:113-114`, `status.ex:123`). Consistent; not a finding.
- `sees` passed in (`shared.ts`, default `() => false`): avoids the light to status import cycle; the safe default keeps every other caller silent.
- Spell `sees` without a steps counter (`spell.ts:85`) matches `fightBack` (`spell.ts:112`). PR claim rerun: holds.
- PR claim `proposal.ts:255` counts `query_steps`: holds.
- Size allowance raises (320 to 321, 440 to 445): match the added lines.
- `/code-review medium` result is reported in the PR body.
- Actor scope (Realm seams 1, 2, 5): the line joins the delivery narration of `actor` only (`reaction.ts` `sequence`, `bodyOf(then, actor)`); no other character's receipt.
- Showcase key reuse (open in /code-review): `observed` reuses `narration.X.applied` text. The decision record marks it as a developer choice. No showcase status is applied to the player, so the reuse gives no duplicate line. Accepted.
- Schema mutant sweep: the PR table lists two schema mutants (the `observed` rename and `observed` as a plain string), both red. Taken from the PR; not rerun.
- `loader_floors.json` case path `cartridge.requires.kernel_api`: both of my floor mutants went red and the baseline is green, so the path matches what both kernels emit.
- No 390 px screenshot: the showcase walk stopped at the Quench dead end (magic 8), and #417 already fixed that on main. Not a finding.

## Test the tests (scratch worktree, `bin/mutate.sh`)

| Mutant | Result |
| --- | --- |
| `shared.ts:297` `first` to `(first \|\| npc)` (refresh on an NPC speaks) | red-narrow |
| `status.ex:77` floor `[1, 110]` to `[1, 109]` | red-narrow, `loader_floors_test.exs` |
| `cartridge_status.ts:51` floor `'1.110'` to `'1.109'` | red-narrow, `loader_floors.test.ts` |
| `shared.ts:297` sight order: `(holder === body \|\| (npc && sees(holder))) && first && label` | **SURVIVED**: showcase_magic, npc_status, status*, reactions, reactions_sampler, budget_record, light, spell_effects. RESTORE-FAIL in the tool output came from my concurrent edit to this record (`git diff HEAD` changed); `cmp` showed the source restored. |

Baseline at the head: `loader_floors_test.exs` and `loader_floors.test.ts` green.

## Findings

1. nit, `kernel/ts/src/mechanics/status/shared.ts:297`: commit b1f3f83c3 calls `sees(holder)` only after `first && label`, and no test pins that order. Failure scenario: a later edit moves `sees` ahead of the label check. Then a reaction that applies a status without `observed` to an NPC in a dark room charges the container walk in `visible` to `query_steps`. Content that was already close to the budget now faults BUDGET, and the suite stays green (the sight-order mutant above survived). The comment at `reaction.ts:133` documents the order, so the risk is low.

## Verdict

APPROVE WITH NOTES.

## Second opinion (anthropic/claude-opus-5-5, head c73751dd)

Checked: Story delivery (actor = root; narration lands in the root proposal, `runtime/proposal.ts:260,294`); dark crypt without light gives no line, lit attic gives the line; Elixir with non-map `narration` gives SCHEMA_VIOLATION, no crash; floors 1.110 match in both loaders; narration is TS-only (Elixir has the floor, no compose), receipts store narration and reopen reads it, so there is no replay or parity drift. Hosted ci, book-e2e, graph-diff green at the head. PR claims rerun: `spell.ts:112` fightBack passes no `sees`; traps' afraid declares no `observed`. Both hold.

| Mutant | Result |
| --- | --- |
| `shared.ts:296` `world.state.containers[holder] === here` to `!!world.state.containers[holder]` | **SURVIVED** (showcase_magic, npc_status, status*, reactions, light) |
| `shared.ts:297` NPC refresh speaks: `label && (holder === body ? first : npc && sees(holder))` | red-narrow (overlaps the first review) |

Findings:

1. should-fix, `kernel/ts/test/showcase_magic.test.ts` magic 9b `off` case: `id(y, 'room', 'loft')` returns undefined (rooms are in `roomIds`; use `room(y, 'loft')`, `showcase_fixture.ts:125`). The golem is put nowhere, not in the loft, so the co-presence check at `shared.ts:296` is unpinned. Failure scenario: with the mutant above, a golem in another lit room gains wet and the player reads "Water sheets off the golem." Probe: golem in the real loft, clean gives `[]`, mutant gives `['narration.wet.applied']`. `visible` (`light/shared.ts:102`) returns true for a non-perception NPC in any lit room, so `sees` does not cover this. Test fix only.
2. question, Realm: sight is judged for the delivery actor, while the line goes to the root receipt. The applied line has the same shape today, and R14 delivers per character; confirm when Realm reactions land.

Verdict: APPROVE WITH NOTES (finding 1 is a test fix in the fix round).

Fix re-check (fb01a509, scoped to `showcase_magic.test.ts` and `mechanics.md` over c73751dd): magic 9b now uses `room(y, 'loft')`; the mutant `containers[holder] === here` to `!!containers[holder]` is red-narrow (magic 9b fails; baseline 13/13 green); the Realm question is recorded as a known limit in mechanics.md status Narration. Finding 1 resolved, question 2 disposed. Verdict: APPROVE.
