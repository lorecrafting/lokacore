# Review: toolbox row 14, dialogue skill checks (loka-kgd.55, batch M6)

- Branch `toolbox/m6-persuade`, head `1107e44c1d3f77096e98682c3ee2858c9468c709`, base `origin/toolbox/batch-m6` `f3d561e6`, 33 files. No PR; handoff in Beads `loka-kgd.55`. Record kept: the slice changes `protocol/dialogue.schema.json`, kernel `COMPOSES` and `kernel_api` 1.47 ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row 14](../MECHANICS-TOOLBOX.md#ranked-toolbox); [dialogue@1](../system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts); [opposed checks](../system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5); new [row 14 section](../system/mechanics.md#dialogue-skill-checks-toolbox-row-14).
- Hosted CI on the head: ci `38066951247` and book-e2e `38066951252`, both success.
- Verdict (first round): **CHANGES REQUIRED**; after the fix round **APPROVE WITH NOTES** (see Fix re-check). One blocker (a mutant survives; the fix is one assertion), two nits, one question.

## Must be true

1. The check is opposed as in row 5: no RNG, it reads the level before the use, each accepted check of a skill with growth is one use (none at the maximum), and a refused choose reads nothing.
2. Pass applies the choice. Failure commits the use and a distinct outcome and line, and applies nothing else of the choice.
3. The check event's subject is the named NPC, else the speaker.
4. No checked answer reaches a once-per-lineage save proof or a fixed-position transfer. The reopened hub row keeps every choice id (`dialogue-save.ts:117`).
5. The compiler and loader refuse the same unsound checks, with the same codes and paths.
6. Chapter 1 and corpus artifacts are byte-identical; no size allowance is raised; no xref cycle.

## Proof

- (1–3) Focused runs green: `dialogue_checks.test.ts`, `skill_growth.test.ts`, `content_choice_checks_test.exs`. TS mutants killed: hub reopens after a check (`behavior.ts:82`); failure without `choice.close` (`sequence.ts:96`); `>=` to `>` (`skills.ts:80`); use dropped (`sequence.ts:93`). Elixir mutants killed: `skill.acquire` clause dropped (`choice_checks.ex:71`); floor 1.47 to 1.46 (`:23`). **Survives**: the speaker-subject fallback replaced by the actor (`sequence.ts:82`), finding 1.
- (4) The loader limits checked choices to `label/narration/sequence/availability/check`; the hub `once` rule still applies. The failure row closes (`checkRow` accepts `closed`, `dialogue-save.ts:99`). A `check_failed` choose receipt routes through `dialogueDetail` and returns early for a non-custody choice (`dialogue-receipt.ts:49`). No mobile test covers this; reasoning only.
- (5) The same 10 refusals are in both test files (codes and paths). No divergent input found.
- (6) All 44 other cartridges compiled at `f3d561e6` and at the head: `cmp` identical. No `size: allow` line changed. `mix xref graph --format cycles`: none. `protocol/fixtures/invalid.json`: additions only (+105/-0).
- Cites rerun: `dialogue-save.ts:117` (`choice_ids` must equal every choice) is backed; `decision.ts:205` `COMPOSES` is backed.
- Judgement, failure branch: a line only is enough. Probe: a W1 reaction `on {event: check_failed, check: intimidate_guard}` assigning `guard_angry` fires on the dialogue failure (events `check_failed, fact_changed, fact_changed`). Content can already attach consequences (lockout, hostility); a failure sequence is not needed now.
- Judgement, retry rule: it is a coherent rule. Attribute checks are fixed until the value changes; skill grinding is capped by the last `growth` entry, the same as row 5's pick.

## Findings

1. **blocker**, `kernel/ts/test/dialogue_checks.test.ts:124`: no test asserts `subject_id` on the speaker path. Mutant `sequence.ts:82` returns `actor_id` instead of the speaker: suite green. Failure: a regression names the player as the subject of every check without an `npc`, so a `status.apply` reaction on `check_failed` hits the player, not the guard. Fix: assert `d.events[0].payload.subject_id === entity('…npc/guard')` for `intimidate`.
2. **nit**, `docs/system/mechanics.md:2040` and `kernel/ts/src/mechanics/dialogue/behavior.ts:71`: the reason given for closing is "never re-chosen … for free uses". A new talk re-chooses for a free use. The real reason is the save rule given in the Retry rule. Reword.
3. **nit**, `docs/system/mechanics.md:2042`: the once-only recipe names only a fact that the pass sets. Add the reaction route on `check_failed {check}` that the probe confirmed.
- **Question (PM/designer)**: Talk and Choose have no cost and no cooldown. A skill whose recipe use is paced by cooldown or cost can be ground to its last threshold through a dialogue check on the same `uses_<key>`. Accept this, or require a cost?

## Merge with `toolbox/m6-facts` (`4881dca7`, trial only)

- Conflicts: `kernel/ts/src/mechanics/dialogue/rule.ts` (semantic), `docs/system/mechanics.md`, `docs/system/cartridge.md`, `protocol/cartridge.schema.json`, `protocol/fixtures/invalid.json`, plus generated `docs/contracts.gen.md`, `docs/system-graph.gen.json`, `docs/toolbox.gen.json`, `kernel/ts/src/contracts.gen.ts` (regenerate).
- `rule.ts`: both branches add a 6th parameter to `sequence()`: `speaker` (W2) and `start` (here). The resolution must move W2's `{...step, subject: speaker}` into `mechanics/dialogue/sequence.ts` and keep both parameters.
- `runtime/world.ts` `kernel_api: '1.47'` merges cleanly (same line on both sides). That is correct only if both rows land in M6 together; otherwise the later one needs 1.48.

## Fix re-check (head `9cd12ea1da8421c854172119adf794438ba34ac0`, fix commit `9cd12ea1`)

Scope: the fix commit only (`dialogue_checks.test.ts`, `behavior.ts`, `mechanics.md`).

- **F1 fixed.** `kernel/ts/test/dialogue_checks.test.ts:131` asserts the intimidate check's `subject_id` is the guard. Focused run green. Mutant rerun: `sequence.ts:82` returns `actor_id` instead of the speaker, and the test "a failed check reads its failure line…" now fails (killed).
- **N2 fixed.** `behavior.ts:71` and `mechanics.md:2040` now give the save rule as the closing reason (a new talk may choose the choice again).
- **N3 fixed.** `mechanics.md:2042` adds a fact set by a reaction on `check_failed` for the check's key.
- **Question settled (PM ruling, 2026-10-10):** dialogue checks need no cost or cooldown; growth is capped by the last `growth` entry, as in row 5.
- Hosted CI on `9cd12ea1`: ci `38068368545` and book-e2e `38068368514`, both success.
- Verdict: **APPROVE WITH NOTES** (notes: the m6-facts merge items above).
