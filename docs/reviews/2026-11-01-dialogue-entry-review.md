# Review: dialogue entry (loka-vduxr.25, loka-vduxr.14)

PR #556, branch `engine/dialogue-entry`, commit `5ae0ea57be4f133ec4235b33bf018e5bc9dfa2a2`.
CI at that head: ci, book-e2e and graph-diff all completed, success.
Governing: [mechanics.md Branching dialogue](../system/mechanics.md), [writing-the-game.md](../guides/writing-the-game.md), [WORKFLOW review stance](../WORKFLOW.md).

**Verdict: CHANGES REQUIRED** (one blocker, a test gap; the behaviour at this head is right).

## Must be true (written before the diff)

1. An explicit `entry: true` wins for its speaker; keyword dialogues stay spoken.
2. Unmarked: Talk opens at a root, first by key whose policy holds and shows a choice.
3. A rootless loop opens at its most-linking member (no end, repeats or self), first key on a tie, warning with the node; a loop downstream of an entry is never an entry.
4. Elixir and TypeScript agree.
5. Selection acts only at Talk: open rows and saves are unaffected.
6. No hash or transcript drift beyond the pin.
7. Two markers, or a marker on a keyword dialogue, are refused.

## Findings

**Blocker. Rule 1 has no test in either kernel.** `kernel/ts/src/mechanics/dialogue/selection.ts:52`, `lib/loka/content/dialogue_links.ex:157`; gaps at `kernel/ts/test/dialogue_branching.test.ts:594`, `test/loka/content_dialogue_links_test.exs:347`.
Mutant: drop `d.entry ||` from `selection.ts:52`. Full `npm test`: 1806 pass, 0 fail. The same mutant at `dialogue_links.ex:157`: `content_dialogue_links_test.exs` and `content_scene_verbs_test.exs`, 59 pass. Also listed as survivors by `bin/mutate_diff.sh`.
TS failure: speaker Z's root links to A's `entry: true` hub, or A's own keyword dialogue does. At head `entries` gives `[a_hub, z_intro]`; under the mutant `[z_intro]`, so Talk to A finds nothing, against the guide's "whatever else leads to it". The tests only use same-speaker shapes, where `heads` rescues the marked dialogue.
Elixir failure (warnings only, `entries` does not drive Talk there): `z_intro` to `a_hub` (marked) to `a_x` to `a_hub`. At head no warning; under the mutant a false LOOP_SPEAKER on `a_hub` and `a_x`. Without the loop, warnings are the same at head and under the mutant, so the Elixir case must use this loop shape.

**Nit.** PR body says kernel_api 1.136 to 1.137; head is 1.137 to 1.138 (`kernel/ts/src/runtime/world.ts:110`).
**Nit.** PR body cites self-link at `selection.ts:52`, `dialogue_links.ex:99`; actual `selection.ts:57`, `dialogue_links.ex:85` and `:177`.
**Nit.** PR body's mutant table is the older narrow list. At head `bin/mutate_diff.sh`: 37 mutants, 23 red, 14 survived, no TIMEBOX. Against `dialogue_branching` and `speech`, 8 of the TS survivors die; `selection.ts:59` `<`, `>` and `0` are equivalent on unique keys; `:52` is the blocker.
**Nit.** `lib/loka/content/dialogue_links.ex:116`: a clear three-node hub draws ENTRY_GUESSED though nothing tied. Harmless; the guide says "whenever that is a guess".
**Nit.** `entry: true` in a scene header gives SCHEMA_VIOLATION wrong_speaker at line 2: refused loudly, but the words mislead; the marker belongs in `dialogues/<key>.json`.

**Question (pre-existing, same walk on main; follow-up bead, not this PR).** `intro` (condition, now failing) `then` `hub`: Talk is refused for good with no compile warning. Marking `hub` shuts `intro` out with ENTRY_UNUSED, so the marker cannot express it.

## Evidence

- Shapes in both kernels: two-node main/detail opens `detail` with ENTRY_GUESSED naming it (first key; the guide states it); three-node hub opens `main`; leaves take the first that holds; entry's condition false refuses Talk, no dead end and no silent mid-conversation start; two markers and a keyword marker give ENTRY_INVALID.
- ENTRY_UNUSED is sensible: the shut-out dialogue really never opens. The marker suits a hub; staged conversations use `when:`, as the guide says.
- Differential: 5000 random graphs through both `entries`, 0 diffs; red control (rank flipped) 554 diffs. Shared cases: none in the repo (PR body records this as open).
- Save: a marker added mid-conversation leaves the row on its source and choose proceeds; a marker change is a new content hash and an old save stays on its pinned release (`mobile/authority/local-story/authority.ts:96`). No migration.
- All 107 cartridges, showcase and samplers included, compile to identical sha256 at head and merge base; no ENTRY_ or LOOP warnings. No transcript or checkpoint touched. Seven `.sql` fixtures differ only in `1.137` to `1.138`.
- Local `mix test` failures reproduced, not real: 828/832 and 827/832 at load ~24, all `ExUnit.TimeoutError` at 60 s, a different set each run; the same files alone pass.
- Narrow mutants with null controls (TS 36 pass, Elixir 59 pass): self-link, width flip, keyword shut out, tie order, `dialogue_links.ex:64`, two markers, unused, guess all red.
- Claims rerun: `dialogue_links.ex:64` keyword LOOP_SPEAKER (red); self-link exclusion fails in both kernels (red).
- loka-vduxr.14 documented only, needs a ruling; PR closes no issue, bead stays open. `/code-review medium` reported in the body.

## Disposition

Open until the blocker's two tests land and each is shown red under its mutant.

## Re-check: head `f64e073736638fc8ebf58eda311ccec89019cb46`

Verdict: **CHANGES REQUIRED**. CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.

Must hold under the PM's ruling (a root or marked entry whose condition fails falls through to what it leads to, in link order): intro then hub across reload; a fall-through never runs what a choice guards; it ends; the compile warning says what Talk opens.

**Blocker. The fall-through walks past choice gates.** `kernel/ts/src/mechanics/dialogue/selection.ts:72`, through `links`: every `then` and `then_failed`, ignoring the choice's policy and check. Guard's intro `when:` fails, Talk opens at once, no warning:
hidden `a_pay` to `secret` opens `secret`; `a_persuade` `then: win` opens `win` with no roll; `then_failed: angry` alone opens `angry` with no failed check. A paid choice's target goes the same way, by reading. Failure: a reward node the writer put behind a check is free. PM to rule: does "what it leads to" include a gated, paid or checked target? The ruling did not say, and a reward opened for nothing is the failure either way; my reading is to follow only a choice the player could take for nothing (plain `then`, policy holding).

**Blocker. Two mutants survive what a test says it catches.** `kernel/ts/test/dialogue_branching.test.ts:612`. Against all six dialogue and speech test files, 76 pass under each.
Remove the same-speaker filter (`selection.ts:76`): green; a failed entry whose only link is another speaker's dialogue is then accepted and opens that dialogue (rejected at head). Remove `word === undefined` (`selection.ts:168`): green; a failed keyword dialogue then opens `hub` on the word, not `undefined`.

**Should-fix. A named entry opens something else under its own label.** `selection.ts:207`. Failed `name: dialogue.guard.persuade`, press with its `dialogue` ref: offered available, opens the hub. Refused before. The name is a promise to the player; a press that selects one dialogue should not fall through.

**Should-fix. The warning does not say what Talk opens.** `lib/loka/content/dialogue_links.ex:111`. A hub with `when:` and links `a_buy`, `z_g`, marked or not: full compile accepts it with no entry or link warning; Talk opens `a_buy`, mid-conversation. A writer closing a shop with a condition gets a detail page. Warn with the target when a conditional entry has more than one same-speaker link.
Second divergence, `dialogue_links.ex:81`: the guess ranks over live dialogues, TS `width` (`selection.ts:57`) over all. `p` to `q`, shut `x`; `q` to `p`, live `r`: TS tie, `p` opens, no warning. `p` to `q`, shut `x`; `q` to `p`: clear in TS, ENTRY_GUESSED on `p`, a false warning. TS is the truth: the compile accepts a link into a shut-out dialogue and that link plays (`g.choose` opened it), so the comment at `dialogue_links.ex:110` is false and the ranking must count it.

**Nit.** `/code-review` result missing from the PR body (0 matches).
**Nit.** "Link order" is choice key order, not written order: `z` then `a` opens `a`'s target. The guide does not say so.
**Nit.** `docs/guides/writing-the-game.md:81`: "every Talk once the condition fails opens the hub" is false beside another passing root (opens `z_other`).
**Nit.** Test title `dialogue_branching.test.ts:668` still says "refuses when its policy fails"; now only with nowhere to go.

Answers:
- Intro then hub across reload: first Talk intro, afterward hub; holds in the developer's test, null control green, offer mutant red.
- Loop: none. `tried.includes` bounds the walk; `circle` case rejected.
- Two available Talks: both unnamed, neither press carries a `dialogue`, both open `z_other`. Book's `talkOf` (`mobile/app/book/offers.ts:125`) shows one card. Accept, same as two passing roots.
- Size allow 690: agree, under the 750 cap with one harness. The fixes may need up to 750 or a new file.
- Entry-wins mutants: both of mine red (`entry: true opens a hub another speaker leads to`; `another speaker's root leading to a marked hub draws no LOOP_SPEAKER`). Also red: link order, offer keeps policy, `Map.take`, width compare.
- Round 1 nits: `kernel_api` body fixed; scene `entry` message fixed; clear hub warning fixed except the case above.
- Shipped content: no `then` in any `cartridges/*/dialogues/*.json`, so nothing changes today.

Not run: full suite under mutants; `bin/mutate_diff.sh` (hand mutants at this round, per the scope); the Book screen itself.
