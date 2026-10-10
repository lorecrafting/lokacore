# Review: lore codex and deduction, toolbox row 46 (loka-kgd.58)

- Local branch `toolbox/m6-codex`, head `1b77b8b09d6a7431ced361ca88beae9970affae6`, diff `33f49e91...1b77b8b0` (39 files); no PR (batch M6). Protocol change (GameView schema, invalid fixtures, contracts), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row 46](../MECHANICS-TOOLBOX.md#ranked-toolbox), [action_recipe@1](../system/mechanics.md#action_recipe1-mechanicsaction_reciperulets49), [B6 topics](../system/mechanics.md#s4-all-hours-wisp-b6-selected-contract), [composition](../system/architecture.md#building-mechanics-by-composition), brief and owner rulings in Beads `loka-kgd.58`.
- Hosted ci and book-e2e on the head: green (per PM).
- Verdict: **CHANGES REQUIRED** (two surviving mutants; precedent: [row 31 review](2026-10-10-toolbox-m4-sky-review.md)).

## Must be true

1. The Journal lists the known topics (topics@1 projection) and a read book (here: by its topic); badges are visible there.
2. A deduction is offered only for at least two distinct known topics whose `all` grants an unknown third topic; once granted it disappears; the grant happens once.
3. Projection only: no cartridge field, no save row, no new writer; deterministic from committed state; TS-only view, so no Elixir parity duty beyond schema fixtures.
4. The card matches admission: offered where the place offers it, the action's own reason where listed unavailable, "Not here" elsewhere.
5. Chapter 1 and the corpus project the same GameView.
6. "Visited all five rooms" badge on the fifth room, not before.

## Proof

- Baseline: `kernel/ts/test/codex.test.ts` 2/2; `SectionPages.stories.tsx` 11/11 (reproduces the developer's claim).
- Mutants killed: M2 drop `!known(grants.fact)`; M3 drop `from.every(known)` (`shared.ts:64-67`); B1 never use the place button; B3 `" + "` join changed.
- Mutants survived: **M1** `from.length >= 2` to `>= 1` (`shared.ts:64`); **B2** reason always "Not here" (`journal.tsx:84`).
- Corpus: jq over every `cartridges/*/recipes/*.json` with an `all` of `fact_compare equals: true`: only `codex_sampler` reads topic facts, so no other test reaches M1's branch and no corpus false positive exists.
- Chapter 1: compiled `ashmere_missing_child`, bell and ward set true; `gameView` JSON with the head `lore` and with the base `knownTopics` line is byte-identical; `deductions` absent.
- Placement probe on the sampler: at the study the view lists `deduce_smugglers` available; on the road it lists nothing, so the Journal shows "Not here" (desk-only, owner ruling).
- Claim rerun: reaction `apply` ops at 33f49e91 and at batch head 9d4612d4 are `fact.assign`, `experience.grant`, `population.suppress`, `quest.*`, `status.apply`: no numeric adjust, so the badge via `visited_count` reactions is justified and meets the row proof (test 1).
- Lint edits are required by the new file (`mobile-renderer-imports.yml`: `journal`) and the new `LABEL` values (`mobile-book-labels.yml`: "Lore", "Not here"). `sections.tsx` 275 lines, allowance removed; no size allowance added.
- `kernel_api` 1.47 is the batch's (rows 14, W10); this slice adds no bump.
- Trial merge into `origin/toolbox/batch-m6` 9d4612d4: conflicts in `docs/system/cartridge.md`, `docs/system/mechanics.md`, `protocol/fixtures/invalid.json` (adjacent appends, keep both), `docs/system-graph.gen.json`, `docs/toolbox.gen.json` (regenerate). Kernel and mobile merge clean.

## Findings

1. **Blocker**, `kernel/ts/src/mechanics/topics/shared.ts:64`: M1 survives. A recipe gated on one known topic that grants another (for example "Ring the bell" after learning the bell) is listed as a deduction with a one-item `from`, which also violates `protocol/gameview.schema.json:1329` (`minItems: 2`). Fix: a one-topic recipe in the test's cartridge, asserting `deductions` absent.
2. **Blocker**, `mobile/app/book/journal.tsx:84`: B2 survives. The spec branch "listed unavailable: the action's own reason" has no story; a regression shows "Not here" while the player stands at the desk (a deduction with a cost or extra policy item). Fix: one story with the action `available: false` and a reason, asserting that reason.
3. **Should-fix**, `mobile/app/book/journal.tsx:18`: with no quests and a known topic (the sampler after one book; Chapter 1 if a topic is learned before any quest) the page says "Nothing written yet." and then lists Lore. Fix the empty-state condition; wording to the designer (`loka-x6t.14`).
4. **Question** (designer, `loka-x6t.14`): Chapter 1 now lists bell and ward on both Character (`mobile/app/book/skills.tsx:13`) and Journal Lore. Not an owner matter: the [C1 journal decision](../decisions/owner-decision-c1-journal-position-polish-2026-10-03.md) does not fix the Journal's contents, and the GameView is unchanged; the duplication is a designer call.

Developer `/code-review` result: reported in Beads `loka-kgd.58` (no PR body yet).

## Fix re-check (round 1, head `bd9fee4531f6e5fa15917aefeda87153dc943b81`)

Scope: `5e44e0d3`, `bd9fee45` only. Verdict: **APPROVE WITH NOTES** (finding 4 stays with the designer, `loka-x6t.14`).

- F1 (finding 1), fixed: `cartridges/codex_sampler/recipes/follow_tracks.json` is gated on one topic (`missing_cart`, not `mill`) and grants `mill`; in the existing state `one` (note read, at the study) `codex.test.ts` asserts `deductions` absent. M1 (`shared.ts:64` `>= 1`) now fails: the actual list contains `follow_tracks`. Baseline 2/2.
- F2 (finding 2), fixed: story `JournalLoreRefused` lists the action `available: false`, `insufficient_resource`, and expects "Think it through: too exhausted". B2 (reason always "Not here", `journal.tsx:84`) now fails that story. Baseline 12/12 (vitest, `SectionPages.stories.tsx`).
- F3 (finding 3), fixed: `mobile/app/book/journal.tsx:18` shows the empty line only with neither quests nor topics; rule added to [Lore details](../system/book-ui.md#lore-details). Red control: restoring the old condition fails `JournalLoreRefused` ("empty line above Lore").
- Spec notes (`book-ui.md`, `mechanics.md` Sampler line) match the code.
