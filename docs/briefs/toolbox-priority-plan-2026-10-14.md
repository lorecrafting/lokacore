# Finish-the-toolbox priority plan (read-only advice, 2026-10-14)

Adopted by the owner 2026-10-14 ("keep going, follow the fable priority plan"); drafted by a Fable planner for the PM.

Sources: `docs/MECHANICS-TOOLBOX.md` and `docs/rnd/depth-and-ux-2026-10-13.md` on `origin/toolbox/batch-m12`,
`docs/decisions/owner-decision-realm-seams-2026-10-13.md`, `docs/rnd/realm-seams-audit-2026-10-13.md`,
`docs/HANDOFF.md`, `docs/SHOWCASE.md`, Beads `loka-kgd.150.*`, `.107`, `.108`, `.109`, `.138-.147`, `.151`, `loka-y6yg`, `loka-b60`.

Lift = developer runs: S = 1, M = 1-2, L = 2-3 (split at brief time). Owner order kept: M12, RS, M13-M15; Settle on a yes.

File threads that must stay sequential (merge-conflict control):
- `mechanics/reaction.ts`: FD1 -> RS-4 (+38) -> FD5 (+kgd.22). Never two in flight.
- `mechanics/policy.ts` (+ `protocol/policy.schema.json`, Elixir parity): 39 (building) -> FD1 `time_since` -> FD2 `skill_compare` -> 16.
- `mechanics/fact.ts`: W13 (merged) -> FD4 -> W15 -> 33.
- `mechanics/population/`: W12 (building) -> `.151` -> 45.
- `mechanics/death/sequence.ts`: 36 arrest relocation + kgd.69 ghost-walk + 47 in one thread.
- `mechanics/commerce/shared.ts`: 33 fence -> kgd.70 barter -> Homestead gifting.
- `view/`: RS-5 before anything that shows a per-viewer name (W15, FD6).
- `kernel_api` line: one bump per engine row; content-only rows bump nothing, so they can run in parallel with anything.

## 1. Batch M12, remaining (3 runs after the in-flight W12, 39, FD8)

| # | Row | Lift | Reason |
|---|---|---|---|
| 1 | FD4 NPC-NPC pair facts (`loka-kgd.141`) | S | Start now: W13 merged, `fact.ts` is free; nothing in flight touches it. Fable #6; feeds W15 and FD5. |
| 2 | FD1 delayed reaction + `time_since` (`loka-kgd.138`) | S | Start when 39 merges (both edit `policy.ts`; FD1 also edits `reaction.ts`). Fable #1, the biggest single-player depth gap; delays in logical units (seams rule 4). |
| 3 | `loka-kgd.151` deer `conflicting_write` | S | Start when W12 merges (same `population/` jobs). Pre-existing kernel bug that the Chapter 1 CI net can hit; fix the shared job write once. |
| - | Row 38 protect objective | S (content) | Move out of M12 into the RS batch as RS-4's witness (it only needs RS-4). Closes M12 without waiting on RS. |
| - | W12 prey hunt | M | Defer (see cuts). |
| - | FD3 storylet deck (`loka-kgd.140`) | M | Re-rank to M13 head (PR edit). M12 is already 10 runs; FD3 is a new module plus a Book Action card, not a world-event row. |

Close M12 as M10/M11: table edit, one Fable batch review, green CI, pinned merge. Showcase district for M12 (owner rule: one district per batch): raid, tracks, ambient lines, rivalry.

## 2. Realm seams batch (5-6 runs, no kernel_api change)

| # | Row | Lift | Reason |
|---|---|---|---|
| 1 | RS-1 `actorOf` + freeze lint (`.150.1`) | S | Everything else depends on it; red control; no behaviour change. |
| 2 | RS-4 reaction subject total (`.150.2`) + row 38 content (`.133`) | S-M + S | One run: 38 is the live witness that world-event triggers name the quest holders. Required before M13 row 33. |
| 3 | RS-2 rule-side actor threading (`.150.3`) + RS-3 jobs store their character (`.150.4`) | M | One run: RS-3's files (escort, bleed, population jobs) are inside RS-2's 25 files; splitting them guarantees a conflict. Transcripts byte-identical is the guard. |
| 4 | RS-5 `gameView(world, actor)` (`.150.5`) | M | After RS-2. Must land before 16 and W15 (per-viewer visibility written once). |
| 5 | RS-6 docs contracts (`.150.6`) + RS-8 schedule `when` decision (`.150.7`) | S | Sonnet, parallel with 3-4 (docs only). RS-8 is a PM decision: recommend "loader check: NPC schedule `when` may read instance facts only" (S+S with Elixir parity) over "Story-only" text, because row 33's witness `when` reads player facts. |
| - | RS-7 receipt digests, save v3 (`.150.8`) | M | Deferred (owner Q4); only 48b needs it, and 48b is a defer candidate. |

Filler (Sonnet, no kernel files, parallel with RS): showcase content bugs `loka-y6yg.12-.17` + `loka-kgd.107.19` (solo player never hits) in one content run; `.107.22` readable run export (S) and `.107.21` prose lint (S), which make every later Fable batch review and blind playtest cheaper.

## 3. Batch M13: social depth and law (7-8 runs)

| # | Row | Lift | Reason |
|---|---|---|---|
| 1 | FD2 passive skill voices (`.139`) | S-M | First `policy.ts` row after FD1; Fable #3; cheapest large immersion step. Attach `loka-kgd.23` (skill level on the Character page) only if the Book half is trivial. |
| 2 | FD3 storylet deck (`.140`) | M | Parallel with 1 (new module + W7 hash + Book card; no `policy.ts`). |
| 3 | 16 sneak and hide | M | Needs RS-5 viewer threading (done). Unlocks 33. `light/shared.ts`, `combat/behavior.ts`. |
| 4 | W15 recognition + FD9 earned titles (`.146`) | M | One run: FD9 is the second sampler case of the same displayed-name variant. Parallel with 3 (variants vs perception). |
| 5 | 33 theft, fence, witnessed offense | M | After 16, RS-8, with the G7 `get` lock on the vault NPC in the brief (audit risk). `commerce`, `containment`, `fact.ts`. |
| 6 | FD5 witness ledger (`.142`) + `loka-kgd.22` reaction moves an NPC | S + S | One run on `reaction.ts` after 33: the `witness` filter and the `move` step are the two open W1 acceptance gaps. |
| 7 | `loka-kgd.70` barter | M | Optional tail: same commerce files as 33, and SHOWCASE.md names barter as a Chapter 1 retirement blocker. Else Homestead. |
| 8 | FD7 ask about topic (`.144`) | M | Last; kernel-only until the Book word bar exists (owner decision 1). Defer if the answer is no. |

## 4. Batch M14: law outcomes and travel (6 runs)

| # | Row | Lift | Reason |
|---|---|---|---|
| 1 | 44 race objective | S (content) | Sonnet, any time; W24 + schedule@1 exist. |
| 2 | 35 trial | M | After 33. `scene/rule.ts`. |
| 3 | 36 jail + `loka-kgd.69` ghost-walk death | M + M | One developer, sequential: both are body relocation in `death/sequence.ts`; ghost-walk is a Chapter 1 retirement blocker (SHOWCASE.md), so pull it from M15. |
| 4 | 43a terrain movement costs | M | Parallel with 2-3 (`movement/`). |
| 5 | FD10 companion remarks (`.147`) | S | After FD2 asides; G8 reader. |
| 6 | 45 pet growth, shrunk | S-M | Needs the RS-6 credit paragraph. Shrink from L: age boundary = G3 status expiry + W6 variant + the existing birth cap; no growth engine. |
| - | 43b mount relation | M | Defer (see cuts). |

## 5. Batch M15: meta and tail (4 runs, plus 3 deferred)

| # | Row | Lift | Reason |
|---|---|---|---|
| 1 | 47 death penalty options | S | Same death thread as M14 row 3; a cartridge option on row 4. |
| 2 | W16 languages and literacy | S | `skills.ts` + readable; cheap, no dependencies pending. |
| 3 | G10 writing group: map pins + letters by job | S + S | Keep pins and mail (no text input needed); the notes half waits on the word bar. |
| 4 | FD6 chronicle view (`.143`) | M (view) | Decouple from 48a (it only needs receipts and W27); after RS-5. Fable #9. |
| - | 48a, 48b, 48c chapter carry-over (+ RS-7) | M + L + M (+ M) | Defer: Chapters 2-3 are out of release scope, so no consumer exists; 48b needs RS-7 first. Owner decision 2. |

## 6. After M15

| Order | Group | Lift | Reason |
|---|---|---|---|
| 6a | Built rooms `loka-kgd.109` slices 1-3 | S-M, M, M | Owner: "housing is important; own slot". Deps (G7, 24, 20b) are done; one contract change (layered `exits`). Before Homestead so farms and pens can sit in a built room. Slot is owner decision 4. |
| 6b | Homestead `loka-kgd.108` | 5-6 runs | Order by cost and shared files: cooking (S, `action_recipe` + food; fix or fence `loka-kgd.50` first if any meal buff touches an hp-max attribute), fishing (S-M, harvest 19 + hash table), farming (M, G3 stages + reaction + harvest), animals (M, 20b jobs + birth cap), gifting + barter if not done in M13 (M, commerce + pair-fact affinity), S1 functional furnishing absorbing `.108.6` decoration (M). |
| 6c | Settle (owner yes only) | S3 L, S4 M | S1 moves into Homestead; S2 is cut (duplicate of Built rooms slice 2); S3 settlement and S4 defense remain, after Built rooms and 37/22. |
| 6d | Balance and tooling `loka-kgd.107` | filler | Never a batch: Sonnet runs between batches, no kernel files. Order: `.107.19` + showcase bugs (now), `.107.22`, `.107.21` (during RS), `.107.3` gates (after owner Q2), `.107.9` replay diff, `.107.4` dials (after M13), `.107.20` content graph scheduling; `.107.23` DSL and `.107.25` generation after the toolbox. |

## Cut or defer

- **S2 construction**: cut; duplicate of Built rooms slice 2 (`.109.2`). Mark "merged into Built rooms".
- **Homestead `.108.6` decoration**: fold into S1 (a placed object with no effect is S1's trivial case).
- **W12 prey hunt** (M): defer; if W13's `hunt` behaviour can take a prey plan as target it becomes content, else drop.
- **43b mounts** (M): defer past M15; fixed time and no travel skip make a mount a flavour row; 43a gives the showcase terrain.
- **45 pet growth**: shrink L to S-M (above).
- **48a/48b/48c + RS-7**: defer until a second cartridge is planned (about 5 runs with no consumer).
- **FD7 ask about topic, G10 notes half, `loka-kgd.72/.77/.82`**: hold behind the word bar decision; otherwise they are the fourth and fifth kernel-only text verbs nobody can play.
- **FD9** folds into the W15 run; **RS-3** into the RS-2 run; **row 38** into the RS-4 run.
- **Diagnostics group issues `.107.10-.16`** (seven placeholders): collapse into one recurring batch-close step.
- **`loka-kgd.104`** (spell duration status fault): fold into the spells follow-up; unreachable by content.
- **`loka-b60`**: stays at RC (needs owner spec call: tampered receipt = conflict or save_corrupt).

## Owner decisions needed

1. **Word bar in the mechanics lane** (one Book slice, `loka-x6t.39` = `.72/.77/.82`): say, use-on, cast, ask and notes are built but unplayable. Fable #2. Recommend yes, scheduled after RS.
2. **Defer chapter carry-over** (48a-c) and RS-7 until a second cartridge is planned. Recommend yes.
3. **Settle tier** (HANDOFF Q3): S1 into Homestead, S2 cut, S3+S4 after Homestead on a yes.
4. **Built rooms slot**: after M15 and before Homestead (this plan) or between M13 and M14 (its deps are done). Recommend after M15: keeps the stated M12-RS-M13-M15 order.
5. **Balance 3 gates** showcase-only (HANDOFF Q2). Recommend showcase only.
6. **W9 "sleep provokes"** keep or reverse (HANDOFF Q1).
7. **`loka-b60`** tampered-receipt semantics at RC.

PM re-ranks (no owner needed, done by PR to the table): FD3 M12 -> M13; 38 into RS; kgd.69 M15 -> M14; FD6 decoupled from 48a; kgd.70 M13 tail or Homestead.
