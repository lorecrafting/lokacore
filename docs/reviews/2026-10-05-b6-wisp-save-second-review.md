# B6 Wisp save and protocol second opinion

Local branch `chapter-1/b6-wisp-ward`; exact source head
`e7aeace7f369254e3fb4b3f197dc1b641b6e6e87`, against B7 predecessor
`547f809ccdd587498dee86cb14822f564efee642`. Independent reviewer authored none of the source.

**Verdict: APPROVE.** No open findings.

The governing [S4 mechanic](../system/mechanics.md#s4-all-hours-wisp-b6-selected-contract),
[typed attempt and topic contract](../system/protocol.md#b6-bounded-sitting-and-topic-composition),
[save recovery](../system/save.md#b6-discovery-sitting-and-ward-recovery), and
[B6 brief](../briefs/chapter-one/b6-wisp-ward-riddle-brief-2026-10-05.md)
require one actor/source/quest-bound attempt per accepted wrong answer; count-at-limit closure
in the same writer group; exact replay; historical receipt proof for discovery, answer and
ward; and typed refusal of corrupt rows without repair. The current release is v023/API1.21
with independent artifact and initial-ID answers.

Reviewed the source diff and the load path through `receiptRecovery`, `selectorSave`,
`riddleSave`, `topicsSave`, `dialogueDetail`, and both portable `choice.attempt`
implementations. The saved row, opening receipt, each answer receipt, declared fact
source and exact Talk selector are cross-checked. The existing transaction/adoption
path retains the prior or next state on failed/uncertain COMMIT and replays a stored
invocation without another attempt or grant. The prior Q1/Q2 dialogue paths remain
eligible; the opted selector is confined to labelled actions. Contract fixtures have
literal negative cases for added required fields and bounds. Ponytail review found no
unneeded abstraction or duplicated state to remove: **Lean already. Ship.**

On the exact head, real-SQLite B6 tests passed 6/6; Q2/older story recovery tests
passed 19/19; kernel Wisp tests passed 8/8; Elixir Wisp content and portable tests
passed 4/4. `elixir bin/contracts.exs --check` passed. In a disposable worktree,
replacing the receipt source comparison with a self-comparison made the forged-source
association test fail (exit 1); the reviewed source was restored only in that
disposable worktree. No source changes were made in the review branch.
