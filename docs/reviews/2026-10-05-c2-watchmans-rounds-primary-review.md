# C2 Watchman’s Rounds — primary implementation review

**Verdict: APPROVE.** Exact source
`747113496572892a01224c47cddc0bf4f63d0fdc`, local branch
`slice/c2-watchmans-rounds`, compared with published main `80c3a072`.
Fresh independent reviewer authored none of the implementation. Review-only
branch: `review/c2-primary-7471134`.

## Governing requirements

Derived from the [adopted brief](../briefs/chapter-one/chapter-one-c2-watchmans-rounds-brief-2026-10-05.md),
[mechanics](../system/mechanics.md#s3-finite-watch-patrol-c2-selected-contract),
[route and ownership](../system/cartridge.md#c2-watch-route-and-trust),
[composition and admission](../system/protocol.md#c2-patrol-composition-and-admission),
[recovery](../system/save.md#c2-patrol-attempt-recovery) and
[Book](../system/book-ui.md#c2-watch-patrol-details):

- Original Tobin moves alone on Continue; only accepted player entry over the pending edge earns ordered unique credit. Wren keeps its independent following relation.
- Detours require explicit Rejoin; fatal player death clears attempt credit before revival, preserves the quest/cursor and permits immediate fresh-attempt Restart.
- Fourth qualifying join commits completed S3 and reserved trust together, without learning, money or item rewards; later lawful travel/death cannot invalidate terminal history.
- Exact labelled Talk coexists with C1, and drawn control input survives GameView→Book→authority with the same keyed admission and usable Close.
- Four public rooms and required recovery routes remain usable at every hour; typed portable transitions, compiler/loader ownership checks and cold recovery retain their existing boundaries.

## Findings

No correctness or scope finding. Leader transfer, movement admission and player
entry remain separate; patrol is quest-instance-keyed rather than reusing Wren’s
actor-keyed row. Full-prior lifecycle composition and independent invariant replay
agree in both kernels. The selected restart retains the actual route occurrence,
including repeated connector rooms. Original C1 lessons and exact sword remain
owned by C1. The compiler and loader refuse competing leader writers, bare quest
activation/resolution and ordinary reserved trust writes.

**Ponytail Review:** lean already; no separate complexity finding. One bounded
relation and existing movement/death/quest/dialogue/receipt/Book consumers suffice.
No new scheduler, allocator, framework, dependency or compatibility adapter.

## Independent verification

Pinned mise commands, all exit0:

- `node --test kernel/ts/test/patrol.test.ts kernel/ts/test/patrol_content.test.ts kernel/ts/test/patrol_contracts.test.ts mobile/authority/local-story/patrol.test.ts`: **34/34**. Includes real SQLite cold boundaries, fatal cellar/Wren separation, Restart, C1 payments, uncertain departure/final COMMIT and exact replay.
- Neighboring kernel dialogue/death/combat_flee/escort/quests/quest_dialogue/quest_delivery/missing_child and Book model/live_actions/C1 plus SQLite Wren escort: **116/116**.
- `mix test test/loka/content_patrol_test.exs test/loka/core/patrol_test.exs`: **6/6**, including independently expected lifecycle/refusal rows and two-kernel differential.
- `mix test test/loka/content_missing_child_test.exs test/loka/core/compose_test.exs`: **16/16**, including exact current source-to-independent-artifact comparison.
- Controlled real combat producer with only the pending escape edge available: admitted Flee reaches Green, status together, credit2; no synthetic entered event or fatal flag.

Two plausible mutations in a separate disposable detached worktree each failed,
exit1: retain old credit in fatal reset (fatal regression faults instead of accepted
revival), and omit the complete drawn-input comparison (stale Continue becomes
accepted instead of invalid_state). Both were exactly restored; the two affected
regressions pass **2/2**, exit0, and the source diff is empty. No source/test edit
is included in this review record.

This approves the exact source reviewed. Browser start→pause/recovery→terminal
refresh proof is not claimed: the reported terminal refresh timeout remains under
investigation. The required independent save/protocol opinion and accumulated
publication checks retain their own requirements. Native work remains paused.
No merge or push was performed.
