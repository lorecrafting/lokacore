# Review: narrate and plan move engine steps (PR #403, loka-mytp.1, loka-mytp.2)

- PR [#403](https://github.com/lorecrafting/lokacore/pull/403), branch `toolbox/batch-settle`, exact head `727514b74701f410b98f73e9cec0b576b6b5fdfe`, base `origin/main` (merge base 29622596). This is the combined-head review of two slices, each reviewed earlier on its own head (see Beads `loka-mytp.1` and `loka-mytp.2`). The owner tabled Settle content on 2026-10-15, so this is a standalone toolbox PR. The PR comment holds the same findings.
- Governing sections: [mechanics.md Settle S3-1: narrate](../system/mechanics.md#settle-s3-1-narrate-n1), [FD5 witness ledger and reaction moves (plan move)](../system/mechanics.md#witness-ledger-and-reaction-moves-toolbox-row-fd5-loka-kgd22), [cartridge.md](../system/cartridge.md) (Narrate declarations; Witness and move declarations), [composition](../system/architecture.md#building-mechanics-by-composition), [WORKFLOW review stance](../WORKFLOW.md#review-stance), [AGENTS.md Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Verdict: **APPROVE WITH NOTES** at 727514b7. No blocker. Two docs should-fix findings and two nits.
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. The merge of main changes nothing in the slice files.
2. `narrate` and `npc.move {plan}` each raise the floor to 1.103 independently, in both kernels. Each loader_floors case pins its own feature.
3. The gen files are current: `elixir bin/contracts.exs` leaves no diff.
4. The docs present both as general toolbox steps and promise no parked Settle content.
5. Neither step changes the other's behaviour (narration order; plan-move ops and events).

All five hold except item 4 (findings 1 and 2).

## Checks run

- Merge: `git diff 42084408 727514b7` touches only `.beads/issues.jsonl`. origin/main (b1f7fd3e) has moved since, also only in `.beads`, and `git merge-tree` is clean.
- `elixir bin/contracts.exs` leaves no diff.
- Focused tests green: `kernel/ts` settle and loader_floors; Elixir content_settle and loader_floors.
- loader_floors: the narrate case edits band_out to a bare `npc.move`, and the plan case edits arrival_line to a `fact.assign`. Each case therefore carries one 1.103 feature.
- Mutants (all red; tree restored):
  - TS `apiFloor` plan 103 -> 0: loader_floors red.
  - TS `FLOORS.narrate` 103 -> 0: loader_floors red.
  - Elixir `@floors` narrate 103 -> 0: LoaderFloorsTest red.
  - Elixir `step_floor` plan clause deleted: LoaderFloorsTest red.
  - TS `moveNpc` `.sort()` dropped: two settle.test.ts tests red.
  - Elixir `plan_move` `|| !s["room"]` dropped: content_settle red.
- PR claims rerun: "no save or runtime/proposal.ts change" holds on the diff. `loka-kgd.159` exists and is open.
- CI on 727514b7: graph-diff and book-e2e passed; ci was still running.

## Findings

1. **Should-fix.** `docs/system/mechanics.md:3655` and `:3268`: the composition records name settle-3, settle-4 and settle-6 as consumers. Those slices are parked, so a planner would treat them as live. Use the house form at `:2889`: "Consumer: `settle_sampler`; later Settle content (parked)".
2. **Should-fix.** `docs/MECHANICS-TOOLBOX.md:213`: row S3 says "partial", which suggests settlement work is under way, but S3 is tabled. Row S4 never mentions plan move. The narrate intro (`mechanics.md:3646`) explains the step only through Settle. Record both as general reaction steps that have landed, with settlement content parked. Then rerun `contracts.exs`.
3. **Nit.** `mechanics.md:3266`: in a probe (band_out pointed at `road`), one advance said `settle.arrival_line` twice, once per member, while the character stood in `square`. Add a cross-reference to narrate's every-entrant limit.
4. **Nit.** `lib/loka/content/reactions.ex:258`: `plan_move` sits between the "Row 16" comment and `revealed` (`:272`). Its own comment also repeats `:222`.

## Disposition

Open: findings 1 to 4 (fix round). Settled:
- the merge is isolated from the slice files;
- each floor is pinned on its own in both kernels (mutants red);
- the gen files are current;
- plan-move order and the room rule are tested (mutants red).
