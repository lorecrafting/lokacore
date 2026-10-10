# Item review: toolbox rows 13 + G12, pick and force a barrier (loka-kgd.35, batch M5)

- Branch `toolbox/m5-barrier`, head `799e04f29ef251bd52bc0f5d79781a435ff6e3c6`, base `bb7a62ec` (merge-base with `origin/toolbox/batch-m5`); no PR yet (batch M5 draft). Fresh Opus item review.
- Governing: [toolbox rows 13, G12, slice process, traps](../MECHANICS-TOOLBOX.md#toolbox-slice-process); [mechanics.md](../system/mechanics.md) barrier@1, G1 tags, rows 5/G5, row 10 `opens_when`; [04 §5.0](../archive/spec/04-command-event-effect-protocol.md) (rejection is not a failed attempt).
- Hosted CI on the head: ci success, book-e2e success (`gh run list --commit 799e04f2...`).
- Verdict: **APPROVE WITH NOTES** (one should-fix, two nits, no blocker).

## Must be true

1. A keyless chest opens on a skill check; a failed pick may jam (row 13 proof).
2. A fragile door gives to a STR check; an iron door does not (G12 proof).
3. Content only: no `kernel/ts/src`, `lib`, `protocol` or existing-cartridge diff, so Chapter 1 and corpus bytes are unchanged.
4. A jam strands nothing (trap 8): another route still opens the door.
5. The sampler test fails on a broken engine rule and on broken content.
6. Docs describe what ships, and the G1 rationale still holds.

## Proof

- (3) `git diff --stat bb7a62ec 799e04f2 -- kernel/ts/src lib protocol cartridges` lists only the 16 `cartridges/barrier_sampler` files.
- (1, 2, 4) `barrier_sampler.test.ts` passes at the head. In order it shows: chest refused, pick fails then passes, chest opens; door pick fails and jams; repeat pick and open-north refused; force passes and north opens; iron force and open-east refused.
- (5) Mutants, focused file, each red on the assertion diff: `has_tag` forced true (`policy.ts:68`); opposed `>=` to `>` (`action_recipe/rule.ts:132`); `door_jammed` removed from `pick_door.json`'s policy.
- Design reason rerun: setting `wooden_door.initial` to `locked` makes `mix loka.compile` fail with BARRIER_UNREACHABLE_KEY.
- No engine code reads `fragile`: `grep fragile kernel/ts/src lib` finds nothing outside the generated files.
- Dispute 8 holds. `door` resolves `ambiguous` (`commands/target.ts:70`), and `play/main.ts:255` builds no Command for an ambiguous target. Bare `force` asks which by label, so no silent wrong door.
- Dispute 9 holds. `locks.test.ts:119` pins `lock` on a keyless lid as `not_owned`, and `barrier/rule.ts:93` applies `opens_when` to `open` only.
- Limits accepted. The per-recipe fragile gate: every recipe already names its own detail, so an engine gate would save no authoring, and a generic force verb is new engine scope beyond an S row. The carried chest is documented at `mechanics.md:1918`, and items have no fixed flag.

## Findings

1. should-fix, `docs/system/mechanics.md:1808`: G1 justifies the closed tag enum because rows "key engine code on its name", and says "a world-only label no mechanic reads is a fact". After this slice no engine code reads `fragile`. `force_iron.json:23` `has_tag iron_door fragile` is a constant-false policy, equivalent to omitting the recipe. Scenario: the next row adds an enum tag that only content reads, cites `fragile`, and the G1 rule erodes. Fix: either one sentence in G1 admitting tags that content gates read through `has_tag`, or a Beads note that an engine-owned force rule is LATER.
2. nit, `docs/system/mechanics.md:1920`: says an unforceable lock "says so in a description variant". The iron door says so in its base description (`text.json` `detail.iron_door`) and has no variant.
3. nit, `docs/MECHANICS-TOOLBOX.md:106`: row 13's proof names the chest, but the jam is shown on the wooden door. "May" covers it.

Open: the row statuses read `done (batch M5, content only)`; the PM stamps `#N` at the batch PR.
