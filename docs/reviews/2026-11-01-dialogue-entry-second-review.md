# Second opinion: dialogue entry contract and in-progress play, PR #556 (loka-vduxr.25, loka-vduxr.14)

PR #556, branch `engine/dialogue-entry`, commit `b28db1661f8d74d36247ece3954bd3145c394b15`.
CI at that head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
Governing: [mechanics.md Branching dialogue](../system/mechanics.md), [contract lessons](../lessons/contracts.md), [storage lessons](../lessons/storage.md), [WORKFLOW review stance](../WORKFLOW.md).

**Verdict: APPROVE WITH NOTES.** Three nits, no behaviour change asked. Ruled and not reopened: default Talk falls through closed intros applying gates; named entries refuse; loka-vduxr.27.

## Must be true (written before the diff)

1. `entry` absent: artifact bytes, hashes and receipts unchanged.
2. Schema, Elixir and TS agree on `entry` and the three codes.
3. Rows are never re-selected: a save at any stage reopens to its own row.
4. A fall-through is pure until the target opens: no cost or fact committed.
5. Selection is deterministic: no dependence on map iteration.
6. A refused Talk stays refused: no free pass through a gate.

## Findings

**Nit.** `kernel/ts/src/mechanics/dialogue/selection.ts:173`: `|| selected` is now redundant. The PR body lists "`|| selected` dropped" as red; at this head dropping it stays green in `dialogue_branching`, `dialogue_fall_through` and `speech` (null control green), because a press names a dialogue only through an action's `dialogue` (`commands/action_input.ts:57`, `commands/invocation.ts:125`), set only for a named one, which `d.name` already stops. Failure: a reader trusts a control that no longer catches anything. Delete the clause or the claim.

**Nit.** `lib/loka/content/dialogue_links.ex:134`: `!d["keyword"]` has no test. Removing it: `content_dialogue_links_test.exs` green; it is the only file naming `ENTRY_GUESSED`. Reachable: a scratch case (`policy`, `keyword`, two free links) has no warning at head and a false `ENTRY_GUESSED` under the mutant. Warning only; artifacts unaffected. Fix: one assert beside `named`, at `test/loka/content_dialogue_links_test.exs:341`.

**Nit.** `protocol/cartridge.schema.json:1196` says severity is error except a listed four; `ENTRY_GUESSED` and `ENTRY_UNUSED` warn and are not listed. `:1141`, which gives each code's cause, omits all three new codes. Failure: a repair tool reading the schema takes a warning for a build failure. `LOOP_SPEAKER` and `SPEAKER_ELSEWHERE` have the same gap at `:1141` from before this PR.

## Evidence per requirement

1. All 107 cartridges compiled with merge base `674f15cd5` and head: artifacts and warnings byte-identical. `bin/regen.sh` rerun: exit 0, nothing rewritten. No `protocol/fixtures` or cartridge file changed; mobile differs only in seven `.sql` `kernel_api` pins (1.139 to 1.140; old saves refuse at the pin by standing policy). Old against new `entries` over all artifacts: 0 of 59 entries differ; none has a policy with a free way on, so no shipped Talk changes.
2. Compile probes: two markers on one speaker, `ENTRY_INVALID` both; full-ref `npc` in source, `SCHEMA_VIOLATION`, so the raw `npc` compare is safe; `entry: "yes"`, `SCHEMA_VIOLATION`; `entry: false` falsy in both; unused sibling, `ENTRY_UNUSED`; scene plus same-key JSON merges as the advice says. Shared `test/fixtures/dialogue_entry_cases.json` runs through both suites.
3. and 4. Scratch test through real SQLite on `persuade_sampler`: closed intro with a free link; Talk falls through to the hub with facts JSON-equal before and after; `coldReopen` passes at hub, deep and closed, and the row continues where it was. `talk` (`rule.ts:68-78`) only selects; steps of the choice walked are not run.
5. `then` to keyword, quest or riddle is refused at compile (`dialogue_links.ex:249`), so a fall-through never opens these. `entries` sorts by `cmp`; `onward` takes `Object.values(d.choices)`, bound by content-hash canonical bytes, and choice keys must start with a letter, so no integer-key reordering.
6. Named closed entry with a free link: view unavailable and command rejected, view and rule agree (`invalid_state`).

## Tests

`bin/mutate_diff.sh origin/main` with `MUTATE_MINUTES=15` (my budget): 65 mutants, red-narrow 27, SURVIVED 5, TIMEBOX 33 (all Elixir plus `selection.ts:178`: unrun). The handback ran hand mutants only, so there is no table to compare.
- Survivors cleared: `selection.ts:164` `&&` to `||`: dialogue and speech files, 2 fail (null control 63 pass). `:164` `===` to `!==` #2 (named-press filter inverted): four dialogue files stay green (`dialogue_branching`, `dialogue`, `speech`, `fall_through`, null 64 pass); `patrol.test.ts` (null 7 pass) goes red, 5+ fail. A reflowed clause killed only by that file; no finding. `selection.ts:60` `<`, `>`, `0`: equivalent on unique keys, as the first review found.
- Narrow TS, singly, null green. Red: name stop, word stop, choice policy, talks policy, entry root, live keyword, live all, tie order, same speaker, steps free, BFS order. Green: `selected` stop, first nit.
- Narrow Elixir over the timeboxed area, `content_dialogue_links_test.exs`, null green. Red: keyword refusal, count, same speaker, fall policy, `seen` (timeout), first pick, free npc, free sort, loop live, talked entry, talked keyword. Green: fall keyword, second nit.
- Schema sweep, one drop at a time, Elixir links, explain, scene_verbs, content files (null 134 pass): `entry` type, build fails; `entry` property, 132 red; `ENTRY_INVALID`, 133; `ENTRY_GUESSED`, 128; `ENTRY_UNUSED`, 132. No survivor.
- Full path: a scratch cartridge with `entry: true` compiled (`ENTRY_UNUSED` on the unmarked sibling only), real `loadCartridge` accepted it, `entries` returned only the marked dialogue.
- Base check: `SPEAKER_ELSEWHERE` and `LOOP_SPEAKER` are absent from `cartridge.schema.json:1141` at `674f15cd5` too.
- Tests follow "Writing tests"; no frozen fixture touched.

Claims rerun: `bin/regen.sh` rewrites nothing (holds); `|| d.name` drop red (holds); `|| selected` drop red (does not hold at this head, first nit). `/code-review medium` reported in the body.

Compared with the first record afterwards: its last blocker (default Talk through a named entry) is fixed at `selection.ts:173`; nothing here contradicts it.

Not run: receiving custody on a hub reached by a link (my shape refused at compile, `OUTCOME_MISMATCH`); the Book screen; full suite under mutants; the 33 TIMEBOX rows as such.
