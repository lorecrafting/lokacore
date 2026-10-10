# Review: Dialogue hub, conversations stay open until Leave (PR #345)

- PR #345, branch `feat/dialogue-hub`, head `76523cc6` (code head `919faaa6`). Beads loka-x6t.5.
- Governing: [dialogue@1](../system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts) (amended here); [owner decision](../decisions/owner-decision-dialogue-hub-2026-10-09.md); [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md) §5 (save/kernel record).
- Verdict: **CHANGES REQUIRED** (one should-fix, R1).

## Must be true

1. An accepted non-ending `choose` resolves its row and, in the same decision, opens one fresh pending row with the old row's source, beat, roles and choice ids (never rebound); `choice_opened` follows `choice_resolved`.
2. Quest-resolving or riddle dialogues, `patrol` answers and single-choice dialogues open nothing. Refusals and a riddle's wrong answer are untouched.
3. `close_choice` on the fresh row is Leave the conversation; Talk elsewhere stays refused while it is pending.
4. Save: a failed or lost COMMIT leaves the old row pending; retry settles one hub row; exact retry replays; cold reopen restores the hub. A save written after the change re-decides identically (no new misread); older hub answers open `save_corrupt` (accepted by the decision).

## Proof

- Reopening set: a script over all `cartridges/*/dialogues` lists exactly the PR's hub dialogues (missing_child and r9c: elspeth, a_elspeth_lost, b_elspeth_rescued/stays, b_aldric, a_peg_debt; tobin_watch is all `patrol`). No multi-choice non-quest dialogue carries escort, payment, lesson, exchange or `skill.acquire`, so the four endings cover every one-shot answer in content.
- Mutants (`dialogue.test.ts`, `patrol.test.ts`): no patrol ending, exit 1; no quest ending, exit 1; single-choice threshold `< 1`, exit 1. `at` without `+ 1`: survives, but equivalent (proposal renumbers positions by array order). `events: [opened, ...a.events]`: survives `dialogue.test.ts` and `dialogue_hub.test.ts`; only `stories.test.ts` freshness fails (R1).
- PR claims rerun: `NEXT` (`dialogue.test.ts:386`) recomputed with Python SHA-256 of `["loka-id-v1", CONTEXT, OTHER, 1]`: matches. Removing the `bell-receipt.ts:55` null guard fails `bell.test.ts` "both completed returns keep Silence..." (exit 1): holds.
- `bell-receipt.ts`: a pre-existing crash on any refusal receipt (null command) in the scope; the fix matches `finale-save.ts:81`. Other parsers filter accepted receipts.
- Creatures off-counter Leave (`r9c_creatures_transport.test.ts:274`): legitimate; draws key on command ids, and the file's ~77 sends cannot reach `...0ff`.
- Save (4): choose receipt readers filter by op/event type (`dialogue-receipt.ts:100-117`); no positional check reads a choose receipt. Chained hub rows reopen cold after every answer and after Leave (`e1_dialogue_circuit.ts:9-19`, Elspeth three answers); Peg accept, reopen, Leave, later reopen (`chandlers_debt.test.ts:17-27`); both green on ci 38014962814.
- Elspeth's policy is `all []` (`elspeth.json`), so after `accept` her other topics stay available; only Peg's hub is dead, as the PR lists.
- Elixir: only `compose_choice.ex`/`invariants.ex` touch choice ops; op set unchanged.

## Findings

1. **should-fix**, `kernel/ts/test/dialogue.test.ts:390-434`: the test names "its choice_opened before choice_resolved" as a break, but its answer (`carry`) sets a fact, so `factChanged` (`mechanics/fact.ts:209`) sorts by position and hides array order. A hub answer with no fact (Elspeth `directions`) emitting `choice_opened` first passes every named test; the event stream the Book history reads changes order (regenerated `stories/views` differ under that mutant). Fix: assert the event-type order of a no-fact hub answer (e.g. `settled.decision.events` in `dialogue_hub.test.ts`).
2. **nit**, `kernel/ts/src/mechanics/dialogue/behavior.ts:83`: `mint() as ContinuationId` restates `continuationId(mint)` (`shared.ts:51`).
3. **nit**, `cartridges/ashmere_missing_child/dialogues/b_aldric.json:8`: "Leave Aldric." reopens the hub; the content follow-up proposed in the PR has no Beads issue yet.
4. **question**: a hub left pending while the player walks away refuses every other Talk and the dream's Continue (`scene/dream_shared.ts:75`) until Leave. Per spec; confirm the designer's Book UI item 6 covers it.

## Second opinion (save)

Fresh save-side reviewer on head `76523cc6` (code `919faaa6`), [PR comment](https://github.com/lorecrafting/lokacore/pull/345#issuecomment-6092576028). Verdict, quoted in lower case so this index keeps the primary verdict: approve with notes (no blocker, no should-fix from the save side). Checked: resolve and reopen in one commit (lost COMMIT retries settle one hub row); cold reopen re-derives the hub row (`receipt-history.ts:23`; a non-replayable mint mutant at `behavior.ts:71` fails `dialogue_hub.test.ts` with `save_corrupt`); `origin/main`'s `elspeth-asked.sql` and `vesper-riddle.sql` open `save_corrupt` (Start over), regenerated saves open; the `bell-receipt.ts:55` null-guard mutant fails `bell.test.ts`; adversarial Elspeth and Peg probes on real SQLite reopen correctly.

1. **question (non-blocking)**: `dialogue-save.ts:51` (one resolved custody receive), `deadline-save.ts:61` (at most one accepted offer) and `topics-save.ts:38` (exactly one granting receipt) assume an answer resolves at most once per lineage. Current content is safe (Peg's accepts are refused after acceptance and expiry); a future hub option with receive, `topic.grant` or escort needs an availability that excludes repeats, or must end the hub.
2. **nit**: `docs/system/save.md` does not say that a rule change under the same pin turns older receipt histories into `save_corrupt`; add one line under "Opening a story" citing the decision record.

## Fix re-check (head `093e949a`; commits `9404f616`, `893939c9`, `093e949a`)

Reviewed only the fix commits, the code they touch and its direct callers (`proposal.ts` `farewell`, `selection.ts` `talking`/`leave`/`parted`/`reopens`, `rule.ts` talk, `sequence.ts` Continue, `dream_shared.ts`, `riddle-save.ts`, `cartridge_dialogues.ts` `once`, `hub.ex`). Focused runs green (kernel dialogue, quest_dialogue, dream, cartridge_escort; authority dialogue_hub, dream, wren_riddle; Elixir content_escort, content_ferry 19/19).

- R1 fixed: the event-order mutant (`behavior.ts:100` `[opened, ...a.events]`) now fails `dialogue.test.ts` "an answer returns to the hub".
- R2 fixed: `behavior.ts` uses `continuationId(mint)`.
- R3: Beads loka-x6t.9 tracks the "Leave Aldric." content removal.
- R4 superseded by the PM ruling: a Talk to another speaker or the dream's Continue closes the open conversation first, and a hub conversation closes once the actor and speaker are apart.
- Mutants, each red: no `farewell` (`dialogue.test.ts`); talk without `leave` (`dialogue_hub.test.ts`, real SQLite); `parted` closing one-shot rows (`dialogue.test.ts` stale-choice case, adverse case `walked-away-rejects-new-choice`); `once` without `receive` (`quest_dialogue.test.ts`); Continue without `leave` (`dream.test.ts`); `hub.ex` without `receive` (`content_ferry_test.exs`, `mix test --force`).
- Save readers that count ops on a receipt filter by op type first (`deadline-receipts.ts:28`, `topics-save.ts:54`, `commerce-save.ts:271`); `riddle-save.ts` accepts a talk/Continue receipt that closes the riddle row. TS `once` and `hub.ex` agree (several choices; no quest, riddle, accept or patrol; receive, escort start, `topic.grant`).

No new findings. Verdict: **APPROVE**.
