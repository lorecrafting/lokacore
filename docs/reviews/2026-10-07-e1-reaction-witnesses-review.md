# E1 reaction witnesses (batch AB) review — 2026-10-07

- Subject: local branch `e1/reaction-witnesses` (not pushed), exact head
  `20e446c2ac47b95d6b2bcb2923d8496e03198f61` (developer `bec20165` on `cad4e3a3`, merged with
  PR #288 head `f7c616af`, batch C). Batch diff `git diff f7c616af 20e446c2`.
- Brief: Beads `loka-e1-r9-certification-2rz.7` (21 reaction paths).
- Governing: [branch evidence decision](../decisions/owner-decision-e1-branch-evidence-2026-10-07.md),
  [architecture.md creatures paragraph](../system/architecture.md) (lines 314-332) and
  [E1 policy branch evidence](../system/architecture.md#e1-policy-branch-evidence).
- Reviewer: independent (Opus); authored none of it.

## Verdict

**APPROVE WITH NOTES.** On v042 the 21 credits are exact, d9 is unchanged and every mutant
fails a named test. Two should-fix items concern the shared rule outside v042: the spec claims a
binding (cause to *delivery*) and a read-state derivation (group number) that the code and the
runtime do not guarantee.

## Must be true (written before reading the diff)

1. The trigger is a committed event of the accepted step, and the rule has at least one apply step.
2. Every apply step has an exact committed effect witness, all in one writer group G, and that
   effect is this rule's own delivery.
3. `when` is judged in the state the delivery read: before plus the ops applied before G, at the
   cause's logical time. Credit follows polarity, and negative nodes are never credited.
4. Every effect event's causation is the trigger. An unknown step kind gets no witness.
5. Replay derives all of this from replayed states and the retained receipt.
6. d9 credits are unchanged.

Items 1, 4, 5 and 6 hold. Items 2 and 3 hold on v042 but not in general (S1, S2).

## Findings

**S1 should-fix: effects are bound to the cause event, not to the rule's delivery.**
`kernel/ts/test/e1_obligations.ts:405,423,448,468` take the first op that matches the step anywhere in
the receipt. The causation check (`:413,:439,:456`) accepts any event caused by the same trigger.
architecture.md:330-331 says that causation "binds the effect to that event's delivery". That is
false when two rules share a trigger.

Run probe (`ab-rev-probe.ts`): on the captured lost/prior bell step, add a rule `e_dup` on
`chapel_bell_rung` with `when: village_child_status == "missing"` and apply
`fact.assign village_child_status = lost`. The receipt is unchanged. At its real delivery (after
b) the `when` is false, so the runtime delivers nothing. `reactionWitnesses` still returns
`e_dup`, `e_dup/when/root` and `e_dup/apply/0`, borrowing b's group-2 op and event.

The ponytail comment at `:391-393` presents this as a v042 limit, but it is not withhold-only.
v042 is not affected: a, b and d9 on `chapel_bell_rung` touch disjoint targets, and c and
start_search are alone on their triggers.

Fix: require each matched op to be the only op in the receipt that matches its step, else
withhold. Or pick G first and match the ops inside G. Also correct the "binds … delivery" sentence.

**S2 should-fix: the read state is reconstructed from writer-group numbers, which the runtime does
not order.** Replay does derive it from the retained receipt (`e1_cases.ts:108-109` recomputes
with the retained decision), but by assuming that groups below G are exactly the ops applied
before G. Three runtime paths break that assumption:
- `jobs()` reuses earlier groups for population pairs and bleed pairs
  (`src/runtime/proposal.ts:278`);
- `handoffGroup` reuses a group for the sight handoff;
- `record()` stamps knowledge ops `writer_group: 0` (`src/mechanics/knowledge/shared.ts:24`)
  even when a later group produced them.

So `apply(before, ops<G)` (`e1_obligations.ts:488-492`) can include ops applied after the
delivery. When the effects are the rule's own, the root held at delivery, so the wrong state can
only withhold or credit a wrong `any` child. No v042 `when` has an `any`, and the bell step's
groups are monotonic (`0,0,1,1,2,2,3,3,4`).

architecture.md:370-373 states the composition as exact. Either state the limit (it holds only
when no group below G appears after G's ops in delivery order, and knowledge ops are excluded),
or withhold when the receipt shows a lower group after G.

**N1 nit: `fact.assign` does not compare `op.scope` with the scope the after value is read at.**
At `e1_obligations.ts:448-453`, `value(after, actor, …)` reads the actor's scope. Only
reachable with more than one player, so this is dispute #6 (question, no v042 effect). Replay
recomputes `after`, so a plant that breaks `after = apply(before, ops)` cannot occur.

**N2 nit: the size waiver.** `e1_obligations.ts:1` has `size: allow 540` (529 lines; the limit
is 400 and 540 is within 1.5x). `creditedPolicyPaths` is already exported (`:342`), so the
stated reason ("reuses creditedPolicyPaths") does not require this file. The waiver is
acceptable under the PM direction that batch F moves new witness logic to its own module. It
should not grow.

**Disputes and notes.** I found no numbered developer notes (#4, #5/#7, #6, #10) in Beads, the
commits or the developer worktree. I classified the ponytail clauses instead:
- the first matching cause withholds only;
- any matching op over-credits (S1);
- the world's player as the actor over-credits only with more than one player;
- the group prefix is S2.

#10 (`to: h + 1`): the real cause is at hour 18, so the window is 18–19 and the dispute is moot.

## Evidence

- `npm run typecheck` exits 0. `node --test kernel/ts/test/e1*.test.ts` exits 0.
- `check_ts_size` on the 3 changed files exits 0. The full-repo run fails on pre-existing mobile
  files, the same as at `f7c616af`.
- e1_cases at head: exit 2, 27 cases pass, pending 51, dispositioned 0, witnessed 597; at `f7c616af` exit 2, pending 72, witnessed 576. Exactly 21 paths leave pending (a 5, b 9, c 5, start_search 2), none added, none lost from witnessed; `cad4e3a3` list (95) minus batch C's 23 equals the base 72.
- d9 at base and head: the same three witnessed paths (`d9_suppress_hounds`, `/apply/0`, `/when/root`).
- Mutants (14), each run against `e1_creatures.test.ts`. Every one fails a named test:
  - M1 read state includes G: fails the reaction test's `seen` deepEqual;
  - M2 read state = before: fails the same deepEqual;
  - M3 cause clock dropped: fails "cause time";
  - M4 and M13 effect-event causation dropped: fail "resolved cause" and "assign cause";
  - M5 one-group check dropped: fails "two groups";
  - M6 unchanged assign accepted: fails "assign unchanged";
  - M7 prior instance accepted: fails "prior instance";
  - M8 any prior state accepted: fails "no open instance";
  - M9 failing `when` ignored: fails "read state";
  - M10 after outcome dropped: fails "after outcome";
  - M11 activate scope dropped: fails "other player";
  - M12 suppress expected dropped: fails "control expected";
  - M14 after row state dropped: fails "after state".
- Tests follow AGENTS.md "Writing tests". The expected paths are literals from
  `cartridges/ashmere_missing_child/reactions/*.json`. No frozen fixture was touched.
- Over-engineering: none beyond N2. Folding d9 into the general witness removed 25 lines.

## Re-check: fix round 1 (`ad4710af..d402e379`)

- Subject: local `e1/reaction-witnesses`, spec `893a299d`, code `d402e379`. Fresh reviewer (Opus);
  scoped to the fix commits and the direct callers (`e1_cases.ts` replay, `e1_creatures.test.ts`).
- PM dispositions: S1 own-delivery binding (architecture.md:330-335), S2 group-order withhold
  (architecture.md:372-377), N1 scope, N2 waiver text.

**Verdict: CHANGES REQUIRED** (one blocker, a one-assertion test fix).

### Dispositions

- **S1 closed in code and spec.** `e1_obligations.ts:437-451` counts each fired rule's matched
  ops (deduplicated per rule) and withholds every rule that touches an op claimed twice;
  `:495` withholds quest.fail-only rules. Matches architecture.md:330-335 word for word. The
  e_dup plant fails on the old code (R0 below).
- **S2 closed.** `:496-498` reads the prefix before the first op of group >= G and withholds
  when a lower group appears at or after it; the "lower group after G" plant gives no credit
  (R1). `react()` allocates G as `p.group + 1` and only reused groups are lower, so "first op
  of group >= G" equals "G's first op" in every reachable receipt.
- **N1 closed** (`:420`, `scopeOf`); plant "assign scope" red (R6). **N2 closed**: the reason
  is accurate; the file grew 529 to 535 lines, inside `allow 540`; `check_ts_size` exits 0.
- Extras accepted: the deleted suppress/resolve guards are implied by the shape match
  (`expected`/`value` equal the before/after rows; instance bound via `questOf`). The
  strengthened "transition instance"/"transition to" plants now change one fact each.

### Finding

**B1 blocker: the e_dup plant does not pin "credits none of them".**
`kernel/ts/test/e1_creatures.test.ts:299-302` asserts only that `e_dup` is absent. Mutant R3
("first claimant keeps credit": withhold a rule only when another rule claimed the op first)
passes the whole file, because e_dup is inserted after b. With e_dup authored before b, the same
mutant credits `e_dup`, `/when/root` and `/apply/0` (verified: the reordered test fails with
those three paths). R4 (uniqueness checked on the first step only) also survives. Fix: assert
in the dup state that `b_lost_before_meeting` is also uncredited; that kills R3 and R4.

### Evidence

- `npm run typecheck` 0; `node --test test/e1*.test.ts` 0 (49 pass).
- `e1_cases.ts` on v042 (`1c53bcd8…`): exit 2, 27 cases, pending 51, dispositioned 0, witnessed
  597; pending identical to the first review's list; vs base `f7c616af` exactly 21 reaction
  paths leave pending, none added, none lost; d9's 3 paths witnessed.
- Mutants against `e1_creatures.test.ts`: R0 old obligations red (e_dup credited), R1 no
  group-order guard red, R2 threshold `> 2` red, R5 quest.fail-only allowed red, R6 scope
  unchecked red, R7 prefix includes G red; R3 and R4 green (B1).

## Re-check, fix round 2 (commit `c5dc36c9`)

Scope: the B1 fix only (`kernel/ts/test/e1_creatures.test.ts:289-308`); fresh detached worktree.

**Verdict: APPROVE WITH NOTES.** B1 closed.

- **B1 closed.** The dup assertion now filters `e_dup` and `b_lost_before_meeting` paths and
  expects none, matching architecture.md:330-335 ("credits none of them"). Mutants applied to
  `e1_obligations.ts:437-451`, each red at `e1_creatures.test.ts:304` with b's paths credited:
  R3 (owner map, first claimant keeps credit) and R4 (`matched[0]` only). File restored after.
- **N3 nit:** `e1_creatures.test.ts:291` the `for (const first of [false, true])` key-order
  loop is not needed for B1. With both rules asserted, a single order kills any "one claimant
  keeps credit" mutant (first or last), because one of the two rules gets credited. It costs one
  extra state build; it can stay.
- Evidence: `npm ci` 0; `npm run typecheck` 0; `node --test test/e1*.test.ts` 0 (49 pass, 0 fail).
