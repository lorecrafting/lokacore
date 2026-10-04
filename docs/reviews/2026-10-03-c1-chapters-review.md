# C1 chapters review — PR #139

Reviewed head: `83e306ee6df5831aa4af207c65549b27a15eccd9`; base: `92e20fec0a88cec7577fb5c2323ef52d69a160d4`.

Verdict: **APPROVE WITH NOTES**. One documentation nit, N1, remains for disposition; no correctness finding.

Review depth: normal. Governing clauses: [Chapters](../system/mechanics.md#chapters-kerneltssrcviewts), [GameView](../system/protocol.md#gameview), [compiler/source/development cartridge](../system/cartridge.md), [chapter-one plan §3 slice 9 and §6](../decisions/owner-decision-chapter-one-plan-2026-10-02.md), settled c1-chapters brief including PM transfer corrections, and [emergence principles](../archive/decisions/owner-decision-emergence-2026-09-25.md).

## Requirements derived before implementation review

- Optional non-empty ordered chapter list: opening has title only; every later chapter names a story point and optionally one outcome. Compiler expands short story-point references; both compiler and loader validate shape, title catalog, story-point/outcome references and counted trigger ambiguity.
- The view is player-specific, read-only and absent without chapters. Select the highest reached declaration index, else 0. A selected story-point outcome maps through its dialogue trigger to the persisted quest choice id; only resolved state counts. No selected outcome means any trigger counts.
- Another dialogue resolving the same quest with the counted choice id must fail closed with existing OUTCOME_MISMATCH, at the declared chapter story-point path. Only the selected outcome is counted where specified.
- No persistence, delta, event, runtime quest/dialogue, composition, storage, authority or UI changes. Existing journal and shared Checks behavior, cartridge sources/artifacts/release/hash/trace pins remain unchanged.
- Independent Ashmere chapter fixture distinguishes outcome carry from choice take_it, opening/progress/both endings, crafted mismatched and failed rows, and real SQLite reopen. Expected answers are literals or independent oracle.
- Generator 11 admits the new known answer; metadata/report/PICKED agree. Curated fault remaps preserve original source and first command, original expected literals and prototype regression seed rows.
- Composition reads generic story-point triggers and existing player quest state; no cartridge-specific engine branch, dependency or speculative machinery.

Permission scope: fresh independent Codex primary plus separate Sol opinion is the bounded PM selection under delegated owner authority while Opus quota is unavailable. The existing OUTCOME_MISMATCH cause is the PM’s technical settlement, not an explicit owner answer. I authored none of this PR. Record/index are handed to PM for batching; no push or shared-branch mutation.

## Findings

- **N1 — nit — `docs/system/protocol.md:213` (also `:180`)**: the chapter insertion shifts the cited GameView and resource symbols. A reader following the condition-band references `view.ts:188` and `:207` now lands in `journal`, rather than the default bands and resource projection. Refresh these to `:211` and `:230`; `gameView` is now `:48` rather than `:47`. This is citation drift introduced by this change. W13 already had stale pointers on the base and is not reopened here.

## Review result

The whole base-to-head diff was reviewed once against the requirements above. The spec-first commit `a18a9f9` precedes implementation and records both compiler/loader paths plus the existing diagnostic cause. `view.ts:168` maps each counted trigger to its dialogue quest and choice, uses the existing player-scoped `questOf`, and keeps the highest reached declaration. The loader and compiler reject ambiguous counted sites while admitting unrelated choice ids, different quests and outcomes excluded by a selected marker. Source settings reuse the artifact array schema and existing short-reference expansion. The private manifest schema helper preserves the existing assembly while meeting the complexity cap; no suppression or module scaffolding was added.

The chapter/view schemas are optional at their parent, closed at their object boundaries, and enforce non-empty declarations and non-negative integer indices. Generated contract additions correspond to those schemas. Chapter tests use hand-checked title/index/state/diagnostic literals and actual invocation admission. The SQLite test asserts the literal Reeds chapter after close/reopen as well as parity with headless play. The Python known answer derives from the frozen Ferry, hand-authors changed trigger choices and chapter markers, and copies only the catalog from source.

No runtime quest/dialogue, storage/authority, proposal, composition, UI, persistence, event or op implementation changed. Existing journal behavior and shared Checks export remain intact. Composes-with accurately describes a generic read projection of story-point triggers and player quest state; no content-specific engine branch appears.

Ponytail Review: **Lean already. Ship.** No removable custom machinery, dependency or speculative abstraction found.

## Independent verification

Commands used the pinned toolchain via `mise exec --`. The PM reported all six GitHub jobs successful at the exact reviewed head, and main-base CI/mobile successful. This reviewer did not independently query GitHub or rerun the complete check line.

- `node --test --test-reporter=spec` on kernel chapters/cartridge/validate/journal and authority chapters/faults: **99 passed, exit 0**, including real SQLite reopen and all 17 curated fault representatives (`c1-chapters-primary-focused.log`).
- `mix test` on content_chapters/content_journal/cartridge_cross_kernel/core contracts: **18 passed, exit 0** (`c1-chapters-primary-elixir.log`).
- `elixir bin/contracts.exs --check`: **exit 0**, generated contracts consistent (`c1-chapters-primary-contracts.log`).
- `python3 test/loka/cartridge_chapters_hash.py`: **exit 0**, fixture regenerated byte-identical, SHA-256 `f43a877c6699891e1442df9c1bec44175eb727aa8f23cc1361bccf74c22e8b8c`.
- Inspected and independently executed the developer's simple recompilation script: **all 18 source cartridges compile to exact canonical known answers**, including all 17 preexisting pins (`c1-chapters-primary-recompile.log`).
- Base/head comparison independently found **184 preexisting cartridge/hash/compiled/trace paths unchanged** under the selected pin paths. All **50 prior loader rows and 612 prior invalid-schema rows** remain equal as parsed data; only seven and nine new cases were appended respectively. Simulator regression seed rows are unchanged; only generator metadata changed.
- In-memory simulator pool comparison before/after admitting the new chapter fixture independently confirmed all **16 old/new curated seed pairs preserve source and first-command type**, and new seed **426 selects ashmere_chapters / accept_quest** (`c1-chapters-primary-seed-preservation.log`). Existing anchor expected literals remain unchanged and pass the real fault suite.
- `mix xref callers Loka.Content.Dialogues` confirms the compiler and existing Checks use sites; both are accounted for. `git diff --check` passed.

## Independent mutation controls

Both controls ran only in the throwaway detached review checkout. Neither was committed, and both production files were restored exactly before final green verification.

| Mutation | Actual command | Red result |
|---|---|---|
| `view.ts:180`: compare quest outcome with chapter outcome key rather than trigger choice id | `node --test --test-reporter=spec kernel/ts/test/chapters.test.ts` | **exit 1, 3 of 5 tests fail**: resolved take_it/leave_it, no-outcome projection and crafted resolved/carry row distinguish the keys (`c1-chapters-primary-mutant-trigger-choice.log`) |
| `dialogues.ex:103`: skip counted trigger ambiguity validation | `mix test --force test/loka/content_chapters_test.exs` | **exit 2, 1 of 4 tests fails**: duplicate quest/take_it dialogue compiles successfully instead of the two literal OUTCOME_MISMATCH diagnostics (`c1-chapters-primary-mutant-elixir-ambiguity.log`) |

After restoration: kernel chapters, authority chapters and simulator suites **23 passed, exit 0**; forced compiler chapter suite **4 passed, exit 0**. Git diff confirms both production files restored exactly. The review worktree was removed after record/index handoff.

Developer-provided evidence was inspected but is not represented as independent executions: 20 implementation mutants caught with old focused suites green; nine schema controls caught with zero survivors. The schema script covers every newly declared required member, bound and closed-object constraint; five mutations fail compiler/kernel fixtures, while the two additionalProperties removals, integer weakening and removed chapter reference fail the existing shared schema-subset guard during generation. No new custom checker is introduced. Developer's first normal pre-push failed the existing Credo ABC cap, and the unchanged schema assembly extraction enabled the complete normal-hook retry; no bypass or repeated reviewer full-check run occurred.

## Limits and handoff

Phone/UI interaction and title-page presentation are outside this slice and were not exercised. Future non-dialogue story-point sources retain the governing persisted-record revisit trigger. The separate concurrent Sol opinion will be appended verbatim by PM; this record makes no claim about its verdict. Record/index are handed to PM for the explicitly authorized batch, with no review push, commit or shared-branch mutation.

## Independent Sol second opinion

Verbatim read-only second opinion run concurrently on the same head:

```text
verdict: APPROVE
head: 83e306ee6df5831aa4af207c65549b27a15eccd9
base: 92e20fec0a88cec7577fb5c2323ef52d69a160d4

No findings.

Reviewed the whole diff at normal depth against AGENTS.md, WORKFLOW,
the bounded continuation record, final PM brief corrections, and governing
clauses. Correctness, contracts, test quality, and simplicity satisfy scope.

Actual independent checks:
- Chapter kernel tests: 5 passed.
- Loader, schema, and journal tests: 74 passed.
- Contract generation --check and git diff --check: passed.
- In-memory Elixir compilation matched the independent chapter pin;
  8 invalid-input controls returned literal expected diagnostics.
- Python oracle reproduced the new pin without writes.
- All 17 old hash pins and prior loader/invalid rows unchanged.
- 17 remapped simulator representatives and anchor inputs passed.
- Exact head confirmed; working tree clean.

Material limits:
No edits, source mutations, disk-backed SQLite tests, full-check repeat,
or independent mutation sweep. Six successful exact-head CI checks are
PM-verified evidence; the 20 implementation mutants, 9 schema controls,
and successful hook retry are developer-reported evidence.
```

## PM open findings

N1 is the complete remaining list: refresh the three shifted source citations in docs/system/protocol.md. The independent Sol opinion approves with no findings. Both reviews cover exact head 83e306ee6df5831aa4af207c65549b27a15eccd9; no merge is claimed yet.
