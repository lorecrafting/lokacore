# M1-B2 lifecycle review — 2026-10-04

PR: #155. Source reviewed: `cca22b6f47507cdf8341681599875048026bed9f`; base: `6d53e8a12aae2550e47ad11232d68128e8356625`. Fresh independent primary reviewer; authored none of this slice. Review selection follows the [autonomous mechanics delegation](../decisions/owner-decision-autonomous-mechanics-2026-10-03.md).

## Requirements derived before the diff

From the [brief](../briefs/m1-b2-lifecycle-ui-sampler.md), [PM decision](../decisions/pm-decision-m1-b2-lifecycle-2026-10-04.md), [Save](../system/save.md#durable-elapsed-sessions), [architecture](../system/architecture.md#elapsed-session-driver), [Book](../system/book-ui.md#shared-elapsed-statuscompletion-boundary), and [cartridge](../system/cartridge.md):

1. Resume obligations survive retained input and uncertain candidates. Receipt/freshness preflight precedes fresh evidence; old A keeps its horizon, new reservations cannot inherit old debt, and host turns remain bounded to sixteen commits.
2. App owns one native lifecycle listener/timer chain, supplies wall/monotonic clocks, pauses inactive work, rejects obsolete lifetime/run callbacks, and stops unknown-save/fault work. Confirmed recovery re-arms on a later host turn without recursive or duplicate pulses.
3. Book consumes confirmed boundaries and matched original completions once, preserving original context and settled comparison frame. Ambient changes preserve ordinary page/scroll/chapter/history, show honest pending/catching-up/error status, and never manufacture action success.
4. A departed pending speaker retains real Conversation/history, unavailable answers and actor-owned Leave. Scene continuation stays player-driven while world time proceeds.
5. Sampler 0.0.4 requires API1.1, owns rate 50/start64800 and landing6/inn19 recurrence; existing story content, old pins/receipts/replay and other fixtures remain intact. Native evidence must distinguish the initial full walk from the final-source rebuild/cold-open smoke and must not claim phone or blur proof.

## Verdict

**APPROVE.** No findings and no open implementation items.

## Source review

The App uses the existing one-handle Game, platform AppState and one guarded timeout owner. Resume is armed before the retained-A shortcut; capture consumes it only when fresh resume evidence actually becomes a candidate. `reserve` leaves new input unresolved after prerequisite work and assigns its target only at its own capture, preserving A identity and the sixteen-commit budget. Receipt, malformed-input and freshness checks still precede new sampling.

Book processes each confirmed boundary synchronously through its retained projection before React batches redraws. Terminal results require the original invocation, use the settled frame, clear the bounded attempt once, and retain the named item/NPC context through B conflict and unknown-save retry. Background routing clears action-only return state. The same mounted NpcDetail/NpcPage path carries a departed speaker into Conversation; unavailable answers remain text and Leave uses the offered actor-owned close. Faults remain visible with confirmed state; healthy user recovery schedules App work on a later turn.

Key source spans checked include `mobile/app/App.tsx:71`, `mobile/authority/local-story/session.ts:166`, `mobile/authority/local-story/elapsed.ts:159`, `mobile/authority/local-story/invocation.ts:88`, `mobile/app/book/Book.tsx:58`, `mobile/app/book/presenter.ts:145` and `mobile/app/book/model.ts:52`.

Only the sampler manifest and Bram source change cartridge content. Kernel production, proposal algebra, schemas, non-sampler fixtures, storage format and Game API are unchanged. The helper move reuses the existing SQLite fault seam with eight caller import updates and the existing test-file AST convention; production types exclude the support directory. The final `cca22b6` commit changes only the compiled-artifact parity test's installed peer context from API 1.0 to 1.1. Byte/hash/lock expectations and the other API 1.0 rejection contexts remain intact. The retained controlled peer diagnostic at 1.0 is `KERNEL_API_UNSUPPORTED` at `.cartridge.manifest.requires.kernel_api`; 1.1 loads all nine artifacts.

## Independent execution

All commands used the pinned `mise exec --` toolchain in a new detached checkout at the exact source. Existing dependencies were reused; Elixir dependency/build copies were isolated. No native operations, owner saves, paid services, signing or global cache changes occurred. Logs use private `loka-m1b2-primary-*` basenames and redact private paths.

| Actual command | Terminal outcome |
|---|---|
| `node --test --test-reporter=spec` on elapsed-resume, elapsed-driver, observe, session, faults, App sampler, Book polish, presenter and c1 suites | EXIT0; 89 passed |
| `node --test --test-reporter=spec` on restored elapsed-resume, Book polish, existing smoke and authority sampler suites | EXIT0; 34 passed, 1 existing copied-phone-fixture test skipped |
| `mix test test/loka/cartridge_cross_kernel_test.exs` | EXIT0; 2 passed, including all nine compiled artifacts |
| `mix test test/loka/content_sampler_test.exs` | EXIT0; 1 passed against the independent sampler answer |
| `python3 test/loka/cartridge_sampler_hash.py` | EXIT0; fixture regenerated byte-for-byte, hash `3a667d1b38c66026eda4597879be24b0eec9cb7c61a26b92757e2ad9f31036d6` |
| Temporary real-App retained-A probe, using the actual module and real SQLite with controlled external native inputs | EXIT0; 1 passed |

The temporary App probe kept A pending through the inactive pause, proved no queued wakeup changed confirmed time while inactive, rejected B as conflict, observed A complete once at literal 1663200, and observed the next host turn account the wall gap exactly once to 1663250. A duplicate active event did not add credit or completion. The temporary test addition was removed byte-for-byte.

Independent red controls were performed, rather than adopting the developer's mutation claims:

- Delete `story.requestResume(run)` before the held-A branch in session pulse: `elapsed-resume.test.ts` EXIT1, with actual 864000 versus expected 864050 after A completes. Restored session bytes exactly.
- Remove the completion invocation-id comparison in presenter: the real delayed-Take/B-conflict control EXIT1 because an unrelated completion was consumed (`true` versus expected `false`). Restored presenter bytes exactly.

The restored runs above are green; `git diff --exit-code` proved no tracked production/test/fixture changes remained. The tests assert controlled confirmed worlds, checkpoint rows, original context and literal results; native inputs are the mocked boundary. They do not prove native layout, animation or real JS suspension. No new production checker needs a planted violation.

The PM independently verified all six CI jobs at this exact source had completed SUCCESS before assigning review, and the developer's normal full pre-push finished EXIT0 after the retained first parity failure. These are separate PM/developer facts; this reviewer did not rerun the full broad check line. All reviewer tools/tests finished; no live check remains.

## Evidence and limits

Independently recomputed all 69 entries in the committed evidence SHA256SUMS and all 11 native final-production source hashes: every byte/hash matches the exact review head. The paused and inactive JSON have identical head/checkpoint/receipt rows. Independently applying rate 50 to their 58064ms resumed wall delta yields the recorded 74813/remainder 800 exactly. Inspected the Conversation capture: retained prompt, honest absence, unavailable answer and usable Leave; inspected final-source capture: the saved brass scene line and player Continue.

The evidence accurately distinguishes the initial dirty-source full native walk from the final-source Release rebuild/cold-open Scene smoke after redundant completion bookkeeping was removed. The final parity fix is test-only and does not invalidate those production hashes. The native evidence does not claim an exact native 72-second stopwatch, a physical-phone proof or a blur fix. The PM's separate 61-save original-manifest protection verification is distinct from this reviewer's committed-evidence verification. Existing UI/phone carries remain in their current owning records.

## Simplicity review

Applied installed Ponytail (full) and Ponytail Review, then self-reviewed the actual diff for correctness and realistic failure paths. Existing driver, subscription, route and native lifecycle mechanisms are reused. No scheduler framework, bus, dependencies, configuration surface, whole-World copy or growing completion ledger was introduced. The small lifecycle/recovery and retained-frame guards serve specific required failure cases. **Lean already. Ship.** No over-engineering finding.

The separately requested Sol opinion is independent of this primary review and is appended verbatim by the PM.


## Independent second-model review — PM publication

Requested `gpt-6-sol`, read-only `codex exec`, source `cca22b6f47507cdf8341681599875048026bed9f`. Actual command exited 0. Runtime model identity was not verified. The answer below is verbatim. Answer SHA256: `5153e2e57fac290ea3489c4c9e4d536f09329d84f8fa39db08ce5d7603dcb8bc`; private event transcript SHA256: `b6db0f6e03746bf102ab9eff527ba0367d9e095a1314cbd53a0813ade8e40aa5`. No findings or fix round was required.

```text
APPROVE — PR155 at cca22b6f47507cdf8341681599875048026bed9f, base 6d53e8a12aae2550e47ad11232d68128e8356625.

No open findings. The App clock chain, retained resume obligation, reservation horizon, Book completion routing, sampler contract, and focused tests align with the governing requirements. Ponytail Review found no actionable complexity issue. All 11 recorded native production source hashes match this head.

Scope/limitations: Independent read-only source and evidence review; no tests, builds, generation, or native operations run. CI success and native outcomes were reported by the PM/developer, not rerun here. Runtime model identity was not verified.
```