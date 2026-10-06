# B6 Wisp riddle and ward — independent primary review

Source: `chapter-1/b6-wisp-ward` at `e7aeace7f369254e3fb4b3f197dc1b641b6e6e87`, compared with published main `547f809ccdd587498dee86cb14822f564efee642`. Hosted PR: pending. Reviewer authored none of the source.

**Verdict: APPROVE.** No findings.

## Requirements established before source review

The selected [S4 contract](../system/mechanics.md#s4-all-hours-wisp-b6-selected-contract), [route](../system/cartridge.md#b6-marsh-route-and-tuning), [composition](../system/protocol.md#b6-bounded-sitting-and-topic-composition), [save](../system/save.md#b6-discovery-sitting-and-ward-recovery), [Book](../system/book-ui.md#b6-seek-retry-and-ward-details), and [adopted brief](../briefs/chapter-one/b6-wisp-ward-riddle-brief-2026-10-05.md) require all-hours gear-free reciprocal access; dark-room marker visibility without general exposure; B4 effective-light refusal; threshold equality and owned check/discovery; actor-bound S4 acceptance and one bounded sitting with immediate reset; atomic correct answer/ward grant; exact labelled Aldric Talk alongside other eligible dialogues while unlabelled Q1 retains first-eligible behavior; and strict receipt, counter and topic recovery with explicit corruption refusal.

## Source and evidence

Traced cartridge route, policies and authored dialogues through ActionSet, raw Talk/Choose admission, GameView, Book detail placement, typed choice composition in both kernels, and real SQLite recovery. Q2's unbounded riddle remains separate. The changed capability code uses shared light, facts, quests, choices and receipts; content-specific Wisp and Aldric names stay in the cartridge. Ponytail Review: **Lean already. Ship.** No unsupported abstraction or redundant dependency identified.

Focused checks at the source head passed: 11 Wisp/kernel tests (including the loaded release simulator and portable contract), 6 real SQLite Wisp authority tests, 4 Elixir Wisp/compiler/portable tests, 36 adjacent kernel dialogue/Q2 tests, and 35 adjacent Story/Book tests. `git diff --check` passed. Independent mutants were red: ignoring the exact Talk selector opened Aldric's earlier dialogue instead of ward; omitting the third-wrong close produced a precondition fault. Both files were restored, with a clean source diff. These checks do not replace hosted exact-head CI.
