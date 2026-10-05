# CHAPTER-01 independent review — 2026-10-05

PR: #176. Source reviewed: `06f67ba37a933b94f1c316bb12c64622dfa5f3c4`.

## Requirements derived before reading the diff

From the [cutover decision](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md), [cartridge source](../system/cartridge.md#source-layout), [save opening](../system/save.md#opening-a-story), [mechanics](../system/mechanics.md), and [simulator contract](../system/architecture.md#two-kernels-one-semantic-contract):

- Bundle `ashmere_missing_child@0.0.1`, titled Ashmere — The Missing Child, with an explicit in-progress opening chapter. Q1/main search remain unavailable; real Old Bram scope remains undecided.
- Preserve the ten authentic rooms and Maud S1: five actual kills, earned key/trust, upstairs chest, combat/shrine return, elapsed clock and Book controls. Reuse reviewed mechanics and transactional persistence.
- Remove active temporary Lantern quest, Bram NPC/dialogues, lantern item/story point/scene and search_plan. Preserve historical sources and frozen fixture bytes.
- Open only the distinct chapter save; preserve preview bytes. Exact-pin mismatch must refuse, and Start over requires confirmation.
- Supply independent hash/allocation answers, executed App/save proof, complete Maud/shrine/cold-reopen custody proof, red mutations and distinct active-chapter simulator coverage without altering the historical generator corpus.
- Native preview is separate after review; the owner Simulator/save must not be operated.

## Verdict

**APPROVE.** No blocker, should-fix or nit findings. Fresh reviewer authored none of the source change. Review applies to the source commit above; the following record commit changes only this file and the review index.

## Correctness and composition

- The active source copies 30 retained JSON files byte-for-byte from the reviewed sampler, including all ten rooms, Maud, rat definitions, quest, reward and storage bindings. Only manifest, facts and text change; seven temporary errand definition files are omitted. No active Bram, search_plan or temporary Lantern item/quest/scene references remain. Geographical Lantern names are intentional.
- `mobile/app/App.tsx:14` bundles the chapter pin, and `:31` selects its own database. The executed App test opens real SQLite and preserves both historical save checksums through Start over. Existing exact-pin refusal and confirmed Start over remain unchanged: the normal Book path calls shell.confirm, and SaveError does likewise. Existing save/refusal/recovery tests pass.
- `mobile/authority/local-story/missing_child.test.ts:113` executes five actual kills before acceptance, free shrine return after lethal combat, cold reopen, Maud acceptance/reward, trust +5, resolved journal, chest unlock/Put, cold reopen and Take. Literal independent allocation answers catch shifts from removed definitions.
- The chapter reuses existing death credit, quest, dialogue receive/adjustment, containment, elapsed authority and SQLite writers described in the [composition contract](../system/architecture.md#building-mechanics-by-composition). No new mechanic, primitive, typed consequence, writer, schema or persistence format appears. No new per-mechanic composition record is warranted.
- Historical sampler/proof sources and existing fixture bytes are unchanged. `kernel/ts/test/sim.ts:139` preserves the default generator16 corpus; the separate chapter test runs 32 controlled seeds through the existing per-step invariant checker.

## Independent validation

- GitHub PR head independently read as `06f67ba37a933b94f1c316bb12c64622dfa5f3c4`; all six attached checks completed SUCCESS: changes, lint, elixir, sim, typescript, bundle ([CI](https://github.com/lorecrafting/lokacore/actions/runs/37264612370), [bundle](https://github.com/lorecrafting/lokacore/actions/runs/37264612382)).
- `mise exec -- mix test test/loka/content_missing_child_test.exs`: 1 passed.
- `python3 test/loka/cartridge_missing_child_hash.py`: reproduced `0eabdf9865352c02ec78c538ae03164efb8e85debd3d951dfd1adb3603cfd8e2`; both hash and allocation fixture files remain byte-identical. Inspected oracle independently declares semantics/defaults with Python stdlib; its copied text catalog is explicitly disclosed.
- `mise exec -- node --test --test-reporter=spec mobile/app/chapter.test.ts mobile/authority/local-story/missing_child.test.ts kernel/ts/test/missing_child.test.ts mobile/authority/local-story/saves.test.ts mobile/authority/local-story/start_over.test.ts`: 36 passed on restored source.
- Reviewer red controls in the detached throwaway checkout: App database collides with sampler → chapter-open assertion fails; simulator ignores supplied corpus → actual `ashmere_dusk` versus expected chapter fails; valid rehashed artifact awards trust +4 → actual 4 versus expected 5 fails. Removing receive additionally fails loader validation before gameplay. Every mutation restored; no mutation committed.
- `git diff --check`: passed. Push runs the repository pre-push checks without bypass.

## Simplicity and limits

Ponytail Review: lean already; existing compiler, loader, session, mechanics and save path are reused. The optional test corpus is the smallest seam that preserves historical simulator regressions.

Q1/main search and real Old Bram scope remain intentionally unresolved under the owner cutover decision; no additional story scope is requested here. Native preview refresh remains separate after review. This review operated no Simulator or owner save.


## Separate independent save/bundle second opinion

The PM supplied this independent second opinion verbatim. It supplements the review above and does not change its verdict.

```text
verdict: APPROVE
source head: 06f67ba37a933b94f1c316bb12c64622dfa5f3c4
findings: none.

Validation: All six CI checks succeeded at this exact head. Six focused tests passed, including executed App selection/title/save/Start over with historical sampler bytes untouched, five actual kills, shrine return, Maud reward and cold-reopen chest custody. Existing save/refusal/fault tests: 54 passed. Additional current-chapter checks passed for cold-reopen receipt replay, altered-intent conflict, unchanged receipt/head, SQLite integrity, non-writing missing-pin refusal and missing-resource corruption refusal.

Red control: changing App’s database name to the historical sampler file failed the opening test; restoring it passed. Python regeneration reproduced both committed fixtures unchanged. Retained source matches reviewed sampler mechanics; artifact identity/title are correct and retired errand content is absent. Ponytail Review: lean already. Throwaway checkout removed; no owner checkout, Simulator, PR or review-record changes.
```
