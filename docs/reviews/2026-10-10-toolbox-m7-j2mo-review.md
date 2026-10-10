# Review: reaction fact writes join the row's earlier writer group (loka-j2mo, toolbox M7)

- Local branch `toolbox/m7-j2mo` (no PR), head `fc3e1a4aa0db0544fb56ea1419628a2c58982f9c`, base `origin/toolbox/batch-m7` `837e6a48` (5 files). Kernel proposal contract (writer groups), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [protocol.md](../system/protocol.md) Propose step and Composition (`conflicting_write`, no last-writer-wins); [mechanics.md](../system/mechanics.md) schedule sub-steps and "Rumour by co-presence"; PM brief and rulings in Beads `loka-j2mo`.
- Hosted CI on the head: ci and book-e2e, both success.
- Verdict: **APPROVE WITH NOTES** (one should-fix, two nits, no blocker).

## Must be true

1. A reaction's second (and later) write to one fact row in one advance commits, and each write's `expected` is the value the earlier write left (checked, not last-writer-wins).
2. Status holder keys and fact row keys in the shared map cannot collide.
3. Joining an earlier group breaks no pairing or ordering check; only formerly faulting proposals change, so Chapter 1 receipts are unchanged.
4. One wait equals hour-by-hour play, for any number of repeat fires in the span.

## Proof

- (1) `reaction.ts:228-229` joins `holders.get(at)`; `expected` comes from `now(p)` (`proposal.ts:129`, composes `p.ops`), and `compose.ts:296-298` refuses a stale `expected`. Elixir `compose.ex:83-92` applies the same per-target group rule, so a TS delta with one group per row composes in both.
- (2) Fact key is canonical JSON `{"kind":"fact",...}` (`compose_rows.ts:6`); status holders are raw EntityIds, and `statusGroup` (`status/job.ts:190`) reads body ids only. No collision.
- (3) `initialPair`/`repeatPair` cover only `entity.create` and `quest.retire`. A first write keeps its own group; only a second write moves, and on base that write always faulted `conflicting_write` (base `reaction.ts:227`). No `protocol/`, `cartridges/`, `lib/` or fixture change. Known limit: with a sight job completing in the same advance, a joined write is a back-group op and `sightHandoffValid` (`compose_sight.ts:16`) faults `precondition_failed` instead of `conflicting_write`: fault to fault, as for status joins.
- Pre-existing root/dialogue fault: base `holders` is set only by status code (`reaction.ts:196`), and head adds only reaction fact writes, so a root write followed by a reaction write faults on both.
- Tests: 42 focused files (rumour, e1*, chapters, status, sight, deer, schedule, bleed, population, missing_child) green at head; `mix test test/loka/content_chapters_test.exs` 4 passed (cartridge hash pin; a kernel change cannot move it).
- Mutants on `rumour.test.ts`: no join (`writer_group = group`) red, 2 `conflicting_write`; wrong group (`group - 1`) red; per-sequence map (`holders: new Map()`, status-only sharing) red. Survived: `holders.set(at, group)` (finding 1).
- Cites rechecked: `reaction.ts:228`, `mechanics.md:662-665`, `:2172`, `protocol.md:91-92` match the handoff.

## Findings

1. should-fix, `kernel/ts/test/rumour.test.ts:100`: each row is written exactly twice, so the mutant `holders.set(at, group)` at `reaction.ts:229` (records the latest group) stays green. Under it a three-day one wait (`until(66, 30)`) faults `conflicting_write` on the third write, while head commits and equals hour-by-hour play (probe run). Extend the parity test to a third day.
2. nit, `docs/system/protocol.md:91`: "a fact row an earlier sequence of the advance wrote" reads as including the root or a dialogue; only an earlier reaction's write registers. An author setting a fact in a dialogue choice and rewriting it in a reaction in the same advance still gets `conflicting_write`. Say "an earlier reaction".
3. nit: the handoff reports no `/code-review` result; run it in the fix round.

Question: two different rules on one event writing one row now chain in rule-key order (PM ruling 1). No test covers it; hour-by-hour play also ran both in one advance and faulted before, so "matches hour-by-hour" holds only in the sense that each write is checked.

## Disposition

Mergeable into the M7 batch after finding 1; the nits can ride the fix round.
