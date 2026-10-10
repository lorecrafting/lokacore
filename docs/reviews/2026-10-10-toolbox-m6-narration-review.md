# Review: M6h, reaction step narration reaches the receipt (loka-kgd.13, batch M6)

- Branch `toolbox/m6-narration`, head `7949bbf9c54b1d4b85ea97cc098b1a490c72f875`, base `f3d561e6`; no PR yet (batch M6). Fresh Opus reviewer. A record is kept because the slice changes core proposal composition and receipt content ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts); [status row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1); [row G3 narration](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3); [row 4 level-up completion](../system/mechanics.md#experience-and-levelling-toolbox-row-4); [book-ui conditions](../system/book-ui.md#conditions-details); the brief and PM rulings in Beads `loka-kgd.13`.
- PM rulings not re-opened: pre-fix sampler saves open `save_corrupt`; Buy one-line check is `loka-kgd.62`; combat log routing is `loka-x6t.14`.
- Verdict: **CHANGES REQUIRED** (one blocker, one nit).

## Must be true (written before the diff)

1. Every admitted reaction delivery's lines reach `decision.narration` and the receipt. A delivery that is not admitted adds none.
2. The order is deterministic and documented: root lines, then the root's reactions FIFO, then each due job's line followed by its reactions, with the level-up line last. A test pins that order.
3. Only the player's own body says an applied line. NPC and item holders stay silent (G3). A refresh while active is silent (W25).
4. Receipt replay re-decides receipts and compares them whole, so it checks the order.
5. Chapter 1 and the corpus transcripts stay byte-identical. No size allowance is raised.
6. No mobile receipt check that expects exactly one line can receive a reaction line, apart from the Buy check the PM already ruled on.

## Proof

- (1) `kernel/ts/src/runtime/proposal.ts:252` pushes the lines only after `admit` accepts the delivery. The only line source is `kernel/ts/src/mechanics/reaction.ts:199`. Scene starts and crow deliveries say nothing. `lib/` has no reaction runtime, so there is no Elixir twin.
- (3) Mutant `holder === body` removed: fails `npc_status.test.ts` (dart guard). Mutant `first` removed: fails the exposure refresh test.
- (4) `mobile/authority/local-story/receipt-history.ts:37` compares the whole decision with `same`.
- (5) `transcripts.test.ts` replays the recorded decisions and passes at head. `chapters` and `e1` pass in both the kernel and mobile tests. No fixture, protocol or cartridge file changed. No Chapter 1 cartridge has a `status.apply` step (grep: only the buffs, derived, exposure, needs, npc_status, status and variants samplers). `proposal.ts` is at 340 lines with no allowance change.
- (6) Checked each one-line check. `food-receipt.ts:22`: Eat emits no reaction event. `narration.ts:209`: Bandage emits no event that triggers a reaction. `riddle-receipt.ts:24` and `dialogue-receipt.ts:97`: these require `!d.events.length`. `dialogue-receipt.ts:79`: checks `[0]` only, which is correct while root lines come first. `commerce-save.ts:154`: ruled, `loka-kgd.62`.
- Red control M1 (push removed): fails the kernel exposure test and the mobile status test, as the handoff claims. The `proposal.ts:252` and `reaction.ts:199` cites check out.
- Focused runs (nice 10) at head: 12 kernel files and 5 mobile files, all green. Trial merge into `origin/toolbox/batch-m6` `1b80476c`: clean (`mechanics.md` auto-merged). The same set plus `scoped_facts` (kernel and mobile) and `dialogue_checks` is green. W2 and W24 reaction steps add no narration.
- Hosted `ci` and `book-e2e` on `7949bbf9`: both success (`gh run list --commit`).

## Findings

1. **blocker**, `kernel/ts/test/exposure.test.ts:184` and `mobile/authority/local-story/status.test.ts:81`: no test pins the order that `docs/system/mechanics.md:631` documents. Every new assertion covers a receipt with at most one line. Two order mutants at `proposal.ts:252` stay green. M2 ran on the focused set; M5 ran on the focused set plus `buffs` and `liquid` (kernel) and `liquid` (mobile):
   - M2 defers reaction lines to just before the level-up line.
   - M5 is `p.narration.unshift(...)`.

   Under M5 the divergence is reachable in shipped content. A scratch probe on `buffs_sampler` gives:
   - at head: Drink `[liquid.drank, narration.might.applied]` and play_song `[narration.play_song.actor, narration.inspired.applied]`;
   - under M5: both reversed.

   Under M5 a `choice_resolved` reaction that voices a line would also break reopen at `dialogue-receipt.ts:79` (it checks `[0]`). Fix: add one exact multi-line narration assertion, for example the buffs Drink or song receipt. The blocker closes when M5 fails a committed test. Optional, not gating: if the dev finds a cheap case, also add one where a job's reaction line comes before a later job's line, which pins M2.
2. **nit**: there is no PR body yet, so the developer's `/code-review` result must go in the batch PR body.

Checked, no finding: a 2c buff's first application now voices its authored applied line. That follows row 1 ("applied ... lines come from their receipts"). Only ticks are absent for 2c.
