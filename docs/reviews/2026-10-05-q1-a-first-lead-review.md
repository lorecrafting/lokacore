# Q1-A — Elspeth’s first lead: independent review

PR [#185](https://github.com/lorecrafting/lokacore/pull/185) makes The First Lead playable through explicit acceptance, carrying the Village Green fox drawing, and reporting a possible lead to Elspeth.

- Source head reviewed: `de66051fd61a359d2f1927e1390bce351384169d`.
- Reviewer: fresh Codex agent; authored none of this PR.
- Verdict: **APPROVE**. No findings or open items.

## Acceptance derived before reading the diff

Governing sources: [active cartridge](../system/cartridge.md#source-layout), [quest](../system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets), [dialogue](../system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts), [Book detail order](../system/book-ui.md#detail-page-order), [PM content decision](../decisions/pm-decision-q1-a-first-lead-2026-10-05.md), [no required waiting](../decisions/owner-decision-no-wait-opening-2026-10-05.md), and [delegated copy](../decisions/owner-decision-copy-delegation-2026-10-04.md).

1. Only an explicit Elspeth accept choice starts Q1. Informational directions and early item pickup grant no quest, fact or reward. Elspeth and the complete required route remain usable at every hour.
2. There is one 20g fox drawing at Village Green by the elm. Its ordinary full item page provides authored identity/description, current legal Take/Drop and Leave in the established order, with honest confirmed action narration and inventory navigation.
3. Q1 uses a current-possession objective: accepting while already holding the drawing is immediately ready; dropping removes readiness/report eligibility; retaking restores it. The active/ready/resolved journal text follows the actual state, including cold reopen.
4. The separate report dialogue has priority over the guide only while Q1 is active and the drawing is held. Reporting resolves once, retains the item and describes a possible Wren/south-fen lead without claiming proof. Retry/reopen cannot duplicate resolution; a dropped or unaccepted clue cannot resolve Q1.
5. Elspeth’s guide/directions remain usable before and after resolution, and Maud’s independent offer and earned turn-in remain usable in absent, active-unheld, active-held and resolved Q1 states. Unavailable repeat acceptance follows the existing honest choice admission contract.
6. No Q2 instance/pending state, archived boot duplication, time gate, new primitive, capability or API version is introduced. Content composes installed custody, policy, quest and dialogue semantics without content-specific engine branches.
7. Release 0.0.7 has an independent compiled-artifact/hash and allocation answer used by the actual App. Historical fixtures remain unchanged. Exact prior 0.0.6 saves are refused intact until explicit Start over. Controlled tests must fail on plausible core mutations.

## Findings and validation

No findings. The current-state objective and independent report policy jointly enforce custody; the report dialogue sorts before the always-eligible guide. Reporting has no item handoff or authored fact sequence, so it retains the clue and creates no Q2 state. Existing dialogue admission marks repeat Accept unavailable, and the Book omits that option while preserving the guide’s usable replies and Leave.

The composes-with statement holds: content reads custody and quest state and uses existing quest activation/resolution and dialogue selection. No production kernel, authority or Book implementation changed. Historical release fixtures were preserved; normalizing the new release’s references and removing the declared Q1 additions reproduces 0.0.6 exactly. The independent generator reproduced the new hash and allocation fixtures byte for byte; hash `ab94a17f8b881b15a9b1ac29d111de7aad32bb14232a2d2f47ce1e53f20dbae3`.

Ponytail Review: **Lean already. Ship.** The small authored definitions reuse installed behavior; no abstraction or dependency to remove. Test expectations use literal answers and independent release pins, and existing real SQLite/Book helpers; no new source-text checker, mock-only assertion or frozen expected-answer edit.

| Reviewer validation | Result |
|---|---|
| `mise exec -- node --test --test-reporter=spec mobile/authority/local-story/missing_child.test.ts mobile/app/book/notice_board.test.ts mobile/app/chapter.test.ts kernel/ts/test/missing_child.test.ts` | Exit 0; 22/22 pass, including real Maud offer/five-kill/turn-in paths in all four Q1 states, all 24 hours, actual Book item behavior, prior-save refusal/explicit Start over and 32 chapter simulator seeds |
| `mise exec -- mix test --force test/loka/content_missing_child_test.exs` | Exit 0; 1/1 independent compiler answer passes |
| `python3 test/loka/cartridge_missing_child_hash.py` | Exit 0; no fixture diff |
| Additional controlled reviewer probe through real SQLite authority and actual Book button projection | Preaccept Take/Drop starts nothing; acceptance without custody stays active; accept receipt replay adds no receipt; repeat Accept is unavailable and omitted; directions remain usable; a pending report retains its exact continuation across cold reopen; report resolves once and retains the drawing; a fresh-id second report is refused; Inn remains usable and the journal contains only Q1 |

## Test-the-tests controls

Two plausible mutation classes were planted independently in a throwaway detached worktree at the reviewed source head, never committed:

1. Remove `has_item` from the bundled report eligibility policy and recompute its canonical hash. The explicit-acceptance/custody test fails on the dropped-clue path because the report masks directions (exit 1; 0/1 pass).
2. Change the objective item from `fox_drawing` to `brass_key`. Mutating source alone fails the independent compiler answer (exit 2; 0/1 pass). Mutating the bundled consumer with a valid recomputed hash fails both readiness paths (exit 1; 0/2 pass, expected ready but observed active).

After restoration, all eight production chapter authority tests and the compiler answer passed (both exit 0). The tracked mutation diff was empty and the throwaway worktree was removed.

Native touch/layout validation remains deferred under the owner’s overnight stop. No Metro, Simulator, DeviceHub, preview or owner-save operation was run.
