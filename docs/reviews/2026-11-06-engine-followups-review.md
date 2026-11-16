# Review: engine follow-ups (loka-vduxr.35, loka-vduxr.78, loka-wfrgk.51, loka-kgd.220)

- PR: #676 `fix/engine-followups-2026-11-05`
- Reviewed commit: `288802e6c79746d3fc7bc9a08acc76da981f1f49`
- Governing: [mechanics.md Branching dialogue](../system/mechanics.md#branching-dialogue) ("Links", "After an answer"),
  `protocol/cartridge.schema.json` DiagnosticCode, [WORKFLOW review stance](../WORKFLOW.md#review-stance),
  [SHOWCASE.md](../SHOWCASE.md) re-pin; PM rulings: vduxr.35 option A (`then: end`, structure only, warning with no exemption)
- Independence: independent reviewer (Claude Opus 5.5), authored none of the slice; detached worktree `rev676`
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (two runs, open items listed)
- Verdict: **CHANGES REQUIRED** (two should-fix: code and doc disagree on what ENTRY_GUESSED names; stale pin cite)

## Must be true (written before the diff)

1. `HUB_SHUT` fires exactly where `behavior.ts hub` reopens (plain answer, `reopens`, no `then`/`check`/`patrol`, not `linked`)
   and the answer's steps make the dialogue's own policy fail; not where the talk ends anyway.
2. It is in the closed DiagnosticCode set, `explain.ex`, and mechanics.md beside `ENTRY_GUESSED`; no TS twin is needed
   (dialogue link warnings are compiler-only).
3. `ENTRY_GUESSED` names only targets `spokenBy` can open, in try order, and the doc sentence says what the code does.
4. Content gets `then: end` only; every transcript changes by the cartridge hash alone except `walk_economy_jail`'s
   `work_off` turn, and the kernel reopen is pinned elsewhere.
5. Best-of-three timing still fails a change past the budget on every run.
6. A patrol choice naming a quest with no `patrol` is a diagnostic, not a crash.

## Checks that held

- `hub.ex:92-110` mirrors `behavior.ts:98-99`: `plain_hub?` = `reopens` (>1 choice; a lone `then` choice is excluded by
  `!c["then"]`) + not `linked` (`next` holds `then` and `then_failed`, as `selection.ts:74`). `self_gates` covers
  `not equals v` and `equals w`, alone or under `all`. Test `content_dialogue_links_test.exs:470` covers each exclusion.
- Transcripts: substituting `9b0a6439…` → `396c95de…` in every base transcript and `mobile/app/stories/live/*.sql`
  leaves only `walk_economy_jail.jsonl` different. Structural diff: line 22 drops `choice_opened` (events[2]) and the
  first event's minted id shifts (one fewer continuation minted); line 24 differs by `delta_digest` only. Line 23 is `open west`.
- Kernel reopen pinned at `dialogue_branching.test.ts:81`.
- Timing (`panel.test.ts:310` `within`, `author_flow.test.ts:196`): min of three; a NaN measure fails every run; a
  deterministic overrun fails all three. Accepted: it hides only load noise.
- `patrol.ex:159` `is_map(q["patrol"])`; row `content_patrol_test.exs:68`.
- PR-claim reruns: "0 files differ but walk_economy_jail" confirmed (above); "ENTRY_GUESSED never names something
  that cannot open" refuted (finding 1).

## Findings

1. **should-fix** `lib/loka/content/dialogue_links.ex:298` (`beyond`) vs `docs/system/mechanics.md:504` ("names the
   fall-through targets Talk can open"). `beyond` passes `seen ++ maybe` to `free_links`, so a dialogue reached only
   by a policy-gated choice counts as tried. Planted row in `test/fixtures/dialogue_entry_cases.json`: `a_one` (closed)
   choices `a`→`b_x`, `b` (gate policy)→`d_one` (open); `b_x` (closed) choices `a`→`d_one`, `b`→`e_two` (open).
   Elixir warns `b_x or d_one or e_two`; TS `spokenBy` opens `d_one` (flag false) or `b_x` (flag true), never `e_two`.
   The warning names a dialogue that cannot open. Fix: seed `seen` with only the dialogues the ungated links reach,
   or stop at a target already listed; add the row to the shared fixture so both twins pin it.
2. **should-fix** `docs/system/mechanics.md:505` still cites "pinned by the `walk_economy_jail` transcript" for the
   reopen; that transcript no longer reopens (`then: end`). The pin is `kernel/ts/test/dialogue_branching.test.ts:81`.
3. **nit** `kernel/ts/test/author_flow.test.ts:196` `let second = first` is dead (self-review lists it).
4. **nit** `lib/loka/content/hub.ex:120` (`self_gates`) `HUB_SHUT` misses `any` policies, `scened` and empty-`shown` hubs (false
   negatives only; author-side, self-review lists them).

## Mutants

`bin/mutate_diff.sh origin/main` at the head: 27 mutants, 25 run, **red-narrow 25**, NO-TESTS 2 (`patrol.ex:159`
`== -> !=`, `and -> or`); matches the handback's 25/25. NO-TESTS cleared by hand: restoring the old `patrol.ex:159`
line turns `content_patrol_test.exs` red with `BadBooleanError` (1/2 passed); dropping only `is_map(q["patrol"]) and`
stays green, since `nil["npc"]` is `nil` and the comparison is boolean, so the guard matters only for a non-map
`patrol` value (author-side). Probe row for finding 1 was reverted before the sweep.
