# Q2-C-rescue independent review — PR #190

Source reviewed: `e412193e355f5e131a3c9e9b8b7052dbd410482f`. The reviewer authored none of the implementation. Review and temporary mutations used a disposable detached worktree.

## Requirements derived from the governing specification

Read before the implementation diff: the private PM GO brief, [adoption and composition record](../decisions/pm-decision-q2-c-rescue-2026-10-05.md), and the active [chapter](../system/cartridge.md#q2-c-rescue-return), [mechanics](../system/mechanics.md#escort1), [protocol](../system/protocol.md#typed-escort-relation), [save](../system/save.md#escort-and-alternate-return-recovery) and [Book](../system/book-ui.md#escort-details) clauses.

- Selection after the accepted riddle binds the original living Wren to the actor/body and active Q2 instance, fixes the rescue branch, keeps the message with Vesper, and leaves Q2 active/status missing. The complete stays alternative remains usable; stale choices cannot cross branches.
- One typed relation preserves identity through following, separation, explicit Rejoin and completion. Both portable composers enforce the full expected row and legal status edges. The new dialogue effect and policy leaf require the declared capability/API and valid local roles/references.
- Accepted Move/Flee transfers player and Wren in the same root writer group after ordinary movement admission, with the existing fare and RNG. Fatal combat returns only the player and separates Wren in the death group. Returning to Wren does not itself Rejoin him.
- Elspeth turn-in rechecks following, original living Wren, living Elspeth and actual co-location, plus active quest/branch/status. One proposal completes escort and resolves Q2/status as rescued. Later player movement leaves Wren at Elspeth. Q1 and Maud remain independent.
- Changed-row persistence and each original committed receipt prove the branch, original identity, transitions and terminal. Impossible combinations return typed save_corrupt without repair. Cold reopen, exact retries, both unknown-COMMIT outcomes and Book speaker attribution remain truthful. Historical fixtures and explicit old-pin refusal remain intact.

## Verdict

**APPROVE.** No blocker, should-fix or nit findings. No open primary-review items. The separate protocol/save opinion remains a distinct workflow requirement.

## Implementation and composition

- `kernel/ts/src/mechanics/escort/shared.ts:31` ties the relation to its retained accepted start, actor-owned quest and original NPC. Its shared admission checks run from pending-choice projection and Choose; authored policies separately preserve branch and status locks. Start, Rejoin and terminal dialogue effects join fact/quest/choice operations before the existing atomic proposal.
- `kernel/ts/src/mechanics/movement/sequence.ts:40` appends Wren's transfer only after ordinary admission. Flee still calls this sequence after its existing candidate selection and draw. `kernel/ts/src/mechanics/death/sequence.ts:117` writes separation in the existing death writer group and leaves Wren's containment alone. No additional fare, random draw, snapshot or post-commit callback exists.
- `kernel/ts/src/foundation/compose_escort.ts:11` and `lib/loka/core/compose_escort.ex:10` enforce equivalent legal edges and immutable identity. Both independent invariant implementations verify the final written row. Mutation-target mapping and adoption add one optional state section; fresh worlds keep their prior absent-section shape.
- `mobile/authority/local-story/escort-save.ts:27` validates the original choice/quest/NPC, own transition receipts, latest transition and physical lifecycle. `dialogue-save.ts:99` reconciles mutually exclusive authored branch/status assignments and retains the prior forged-stays-terminal guard. `dialogue-receipt.ts:164` proves each authored escort effect before routing narration to its original speaker. Real SQLite tests exercise lawful separation, cold reopen after Rejoin/completion, replay and failed/lost COMMIT.
- Chapter ordering offers the separate Wren choice without Vesper's item-bound receive restriction, and the terminal retains Elspeth's guide options. Journal outcome selection and Green narration read committed state. The actual new-release stays journey remains green. Historical fixture files are unchanged; only the new escort and v012 fixtures are added.

**Ponytail Review: Lean already. Ship.** The two requested narrow size allowances are justified: `foundation/compose.ts:104` keeps one exhaustive dispatch over the closed delta union (41 lines), and `content/cartridge_dialogues.ts:173` keeps one option's mutually constrained validation together (47 lines). Extracting either solely for line count adds indirection without simplifying these small branches. The global checker limit is unchanged, and the size checker passes. No story name enters the shared escort mechanic; no new dependency, compatibility adapter, command, table or UI mode was added.

## Independent validation

- `mise exec -- node --test kernel/ts/test/{escort,escort_contracts,cartridge_escort,missing_child_stays}.test.ts mobile/authority/local-story/{wren_escort,vesper_message}.test.ts mobile/app/chapter.test.ts`: **58 passed**, exit0. Includes actual chapter rescue/stays journeys, Book/SQLite recovery and corruption controls, old-pin refusal, compiler-facing loader cases and literal portable contracts.
- `mise exec -- mix test test/loka/core/escort_test.exs test/loka/content_escort_test.exs test/loka/content_missing_child_test.exs`: **7 passed**, exit0. Includes literal schema/composition answers, independent invariant refusal, cross-kernel differential and source compiler/reference/API checks.
- Independent mutation: omitted follower transfer from shared movement. Escort tests **exit1**, four failures including ordinary Move and two-exit Flee. Restored.
- Independent mutation: omitted death separation. Escort tests **exit1**, two failures including actual fatal combat/Rejoin. Restored.
- Independent trust mutation: skipped latest committed escort-transition validation. SQLite tests **exit1**; the forged separated-without-death control failed. Restored.
- Restored `escort.test.ts` and `wren_escort.test.ts`: **20 passed**, exit0.
- Three additional temporary controlled-input tests: sitting and zero-MV Move preserve both bodies/relation; a pending terminal refuses Wren moved away before Choose; a following-location mismatch faults without moving or charging the player. **3 passed**, exit0. Probes and mutations are discarded, not committed.
- `mise exec -- python3 test/loka/cartridge_missing_child_hash.py`: exit0, hash `2e05620c7bd1319352aad6b4f0bc7f8479da3a324601b320fb2f9a9b79441a7b`; regenerated fixtures have no diff. `mise exec -- node bin/check_ts_size.mjs`: exit0.
- Confirmed all six source-head GitHub checks green: changes, lint, elixir, typescript, sim and bundle. Record commit/push uses normal hooks.

## Limits

This review independently reran focused schema fixtures and compiler/composer checks; it does not claim an independent rerun of the developer's complete schema-mutant sweep or all mobile/TypeScript tests. Source-head CI supplies the broader check result. No preview, Metro, Simulator, DeviceHub, native build or owner-save operation occurred. No roadmap completion or merge is authorized by this record alone.

## Separate protocol/save opinion — source `e412193e`

Read-only Codex Sol xhigh opinion, appended verbatim below. The primary APPROVE above is independent of this separate finding; PS-1 must be fixed and rechecked before merge.
```text
CHANGES REQUIRED

1. PS-1 | blocker | mobile/authority/local-story/dialogue-receipt.ts:174 — After accepting rescue (or completing it), set the saved Q1 quest row’s value to JSON null and reopen. escortEvidence calls questOf, which dereferences the null row and throws an uncaught TypeError. Recovery loses the required save_corrupt classification and Start over offer. Reproduced in in-memory SQLite; identical corruption before rescue selection receives typed recovery.
```

## Scoped fix recheck — source `e5cca99f`

Reviewed only fix commits `45234317981d352dbbfe31a6e559491ac28f2c3d` and `e5cca99f2348824003c22adc995d8b91ab0b528f`, the changed load boundary and its direct receipt/session consumers. Earlier review and validation above remain historical evidence.

**CHANGES REQUIRED. PS-1 remains open (blocker).** The null-row crash is fixed, but the new guard checks truthiness rather than usable quest/scope references.

- **PS-1 — `mobile/authority/local-story/store.ts:134` at `e5cca99f2348824003c22adc995d8b91ab0b528f`:** After the actual Q1/riddle/rescue journey, replace the existing Q1 (`first_lead`) `state_row` value with JSON `{"quest":{},"scope":{}}` or `{"quest":true,"scope":true}`. Close SQLite, open a fresh connection, and call `localSession`. Both values pass the new guard. The session opens successfully, gives no typed save_corrupt/Start over recovery, and its journal contains only `missing_child`: the damaged Q1 has silently disappeared. Reproduced separately after escort start and after the rescued terminal. Reject unusable quest/scope references at this same boundary before receipt recovery; retain the storage-error distinction.

Independent evidence:

- Existing focused suites (`wren_escort`, `vesper_message`, `saves`, kernel `escort`): **68 passed**, exit0 before mutation and again after restoration. Legitimate rescue, death/Rejoin, terminal, stays, replay and transaction behavior remain green.
- Additional file-backed cold-reopen probes independently wrote nine malformed Q1 values at both stages, closed the original connection and reopened through `localSession`. Null, false, zero, empty array/object, null quest and null scope all return typed save_corrupt, offer explicit Start over, preserve rows before consent and successfully start fresh afterward: **14 corruption cases pass**. The two truthy malformed-field forms above open normally at both stages: **four corruption cases fail**. The parent test also fails, so the temporary probe run reports **15 passes / 5 failures out of 20**, including the separate storage control below.
- A legitimate completed rescue reopens on a fresh connection. A second real SQLite connection holding `BEGIN EXCLUSIVE` causes the normal connection's read to fail as locked, without classifying corruption or offering Start over. Releasing the lock restores readable progress and the saved rows are unchanged: **pass**.
- Independently removed the new two-line load guard: the developer's malformed-Q1 regression test goes **exit1**, all ten corruption subcases fail. Restored the guard. The remaining truthy-field cases fail on the unmodified fix source, not on a mutant.
- All six exact fix-source CI checks are green. No additional complexity finding: the shared-boundary placement is appropriate and avoids catch-all conversion of storage faults; the remaining issue is incomplete input validation. No temporary test or mutant is committed. Normal hooks apply to the review-record push.

No source edits, merge, roadmap completion, preview, device operation, Android/iOS build or native verification was performed.
