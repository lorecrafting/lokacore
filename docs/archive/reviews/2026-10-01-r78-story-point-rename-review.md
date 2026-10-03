# Review: story-sense "milestone" renamed "story point" (pure rename + spec amendment)

- PR: #92, branch `r78-story-beat-rename`, commit reviewed `da0eeefe492b55e8139608562934b8c1cb7df985` (CI green: ci, mobile-bundle).
- Reviewer: independent (Claude Opus), short review (rename slice: no mutation testing, per brief).
- Spec: 23 §3-§7, §11; 03 §9, §26; 05 §27; INDEX §3; IMPORT.md amendments;
  [owner decision](../decisions/owner-decision-story-point-2026-10-01.md).
- **Verdict: APPROVE.**

## Must be true

1. No behaviour change: schema constraints identical apart from names; generated contracts are the
   generator's output; authority/progress/store logic identical; no SQLite schema change.
2. Every remaining "milestone" is the project-plan sense or history; no plan-sense hit renamed.
3. Frozen fixtures change only the key; pinned hashes equal the files' bytes.
4. 23 §3 names `story_point_reached` (a Key); INDEX row 40 is accurate and distinct from scene beats.

## Checks

1. `protocol/account.schema.json`: only def names, `$ref`s, field `milestone`→`story_point`,
   `required` entries and descriptions change; patterns, types, `minItems`,
   `additionalProperties` untouched. `protocol/fixtures/invalid.json`: renames plus the
   `missing_property` errors moving to sorted position (`/story_point` last); same error sets.
   `elixir bin/contracts.exs` on the head leaves the tree clean. `authority.ts`, `progress.ts`,
   `store.ts`: identifier/comment renames only; the `answer()` comparison keeps the same five
   fields. `store.ts` tables (`report` etc.) carry no "milestone" name; no migration needed.
   `story_points.test.ts` (R087): renames, Prettier reflow, and the canonical-JSON expected
   literal reordered to put `story_point` last (correct for sorted keys).
2. Remaining hits (28 outside reviews, plus R-MILESTONES nav links): feature-schema "freeze
   milestone", WORKFLOW, README, ADR-032, 14 §1023, 15 §1881, 03 "shared-Realm milestones",
   pre-release-proof:96, all plan sense; decisions/README:79, split-d record, adr-074 are history.
   The R-MILESTONES/ROADMAP/14/release-scope edits renamed only story-sense text (S5, D2,
   R6/R12A rows, "story point sync"). No stale `#…milestone…` anchors remain.
3. SHA-256 computed: `adverse-cases.json` `c8100a5d…503f3`, `lantern-traces.json`
   `6059753b…c76a0`, equal to IMPORT.md:130-132 and both portable ABI test pins. The fixture
   diff is 18 `"milestone"`→`"story_point"` key lines per side, nothing else. The old hashes
   remain only in IMPORT.md's as-imported table (correct).
4. 23 §3 reads `story_point_reached`, which matches Key `^[a-z][a-z0-9_]*$`. INDEX row 40 cites
   23 §3, 03 §26 ("Story points and platform acceptance"), 05 §27 ("Cartridge completion story
   points"), all present, and separates it from row 25 beats. 03 §9 tables are renamed
   `story_point_reports` / `story_point_acceptances`, as IMPORT.md states.

## Findings

None.

## Notes

- Pending report rows saved before this change hold `"milestone"` JSON; `deliver` would submit
  them as-is. No shipped saves exist (R6 is pre-release), so no migration is required.
