# Owner decision: Bram's quest starts from a dialogue choice — 2026-10-02

Relayed by the PM (Claude Code) after the Gate R6P play, **(paraphrased)**: the wording is smoothed,
not quoted.

- The quest offer is a dialogue choice with Bram that starts the quest, as in modern RPGs. It is
  not a room or place action.
- One-off quest triggers may come later, not now.
- It runs after the gate as a normal slice (the PM's recommendation).

Landing: the Quest from dialogue row of the [ROADMAP](../ROADMAP.md).

## PM notes (not owner decisions)

- On main the offer is the quest's `offer` (`kernel/ts/src/actions.ts:131-135`). Bram's dialogue
  requires `quest_state` active (`cartridges/lantern_proof/dialogues/bram.json`), and the loaders
  reject two dialogues for one speaker. So the slice changes the contract: a spec amendment
  ([pre-release-proof](../archive/spec/pre-release-proof.md) :47, :61; `lantern-traces.json`;
  `adverse-cases.json`), the schema, both loaders, the cartridge and the fixture hash, the walk
  selector in the [mobile lessons](../lessons/mobile.md), and the device rows rerun for the new hash.
- Opus developer; codex Astra reviews it if `proposal.ts` changes.
- Docs compaction runs first, so the spec target may have moved.
