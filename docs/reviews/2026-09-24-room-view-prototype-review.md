# Review: room view prototype (design exploration)

- **PR:** [#17](https://github.com/lorecrafting/lokacore/pull/17), branch `design/room-view-prototype`
- **Commit reviewed:** `ba5e572` (one commit on top of main `4e8f40b`)
- **Reviewer:** fresh Fable session; authored none of the work
- **Depth:** docs-only slice, short review (no mutation testing). CI green on the head
  (elixir, lint, typescript).
- **Verdict:** APPROVE WITH NOTES

## Requirements derived before reading the diff

From AGENTS.md, [00 §4.10](../spec/00-first-cartridge-design.md#410-touch-interface),
[pre-release-proof.md](../spec/pre-release-proof.md) and
`protocol/gameview.schema.json` at `4e8f40b`:

1. The page stays informative: it names `docs/spec` as governing and asks for nothing
   from the schema or the spec.
2. Every "already covers" claim and every "Nearest today" cell matches the schema at
   `4e8f40b`.
3. "Must" is honest against the proof. The Lantern map is landing, north to green, east to
   reed bank, east to shelter, with reciprocal routes and one barred west exit
   (pre-release-proof.md "Fixed content intent"). It has no vertical exit.
4. Repo rules: every Markdown file reachable, links resolve, `check_docs` green, each fact
   in one place.
5. The HTML carries no secrets, device or worktree paths, and no network call beyond
   Google Fonts.

## What checks out

- The intro sentence of "GameView needs" is accurate: `UnavailableReason` has `code` plus
  optional `message` (schema line 933), `Text` carries `bindings`, `PendingChoice` has
  `prompt`, `speaker_id`, `closable` (line 298), `NarrationRecord` exists (line 960) and
  `GameView.time` is required (line 482).
- Rows 2, 3, 4, 7, 9, 12 ("none"): `GameView` is `additionalProperties: false` with no
  resources, position, map, details, topics or exit destination. Row 6 (`EntityView
  {id, name, kind, actions}`), row 8 (`QuestView {quest, state, title}`), row 10 (the
  ActionDefinition description defers aliases to the parser) and row 11
  (`ActionDefinition.accessibility` exists; `AdvertisedAction` does not project it) are all
  correct.
- Row 3 is framed the right way round: the mock rejects movement when not standing
  (`room-view.html:728`), which is UI-decided legality that §4.10 forbids, and the README
  asks GameView for the typed reason instead of keeping that rule in the UI.
- The README says the spec wins on conflict and asks for no schema change. The PR changes
  no code, schema or spec.
- `mise exec -- elixir bin/check_docs.exs`: 74 docs, 0 broken, 0 unreachable.
- HTML: 293 KB over nine files; the only external references are the Google Fonts
  `preconnect` and stylesheet links; no `fetch`, script or media sources, no paths, keys
  or device identifiers. The files are body fragments without `<!doctype>`/`<html>`;
  browsers render them, and offline they fall back to system serif, which the README's
  "load fonts from Google Fonts" sentence covers.
- README prose is short and direct.

## Findings

### F1 (should-fix) `docs/design/room-view/README.md:30` (and the "Must" sentence at line 26)

Row 1 is labelled `must` and listed as a need, and it is neither.

- Not a must: the README defines "must" as "the Lantern loop can't be played by touch
  without it". The proof map has no vertical exit, and the mock's own model has none
  either (`room-view.html:260-263`: `landing`, `green`, `reed`, `shelter` carry only
  `n`/`s`/`e`/`w`), so the joystick's stair nodes never appear while playing the Lantern
  loop.
- Not a gap: `ExitView.direction` is `action.schema.json#/$defs/Key`
  (`^[a-z][a-z0-9_]*$`, "used for action keys, directions"), so `up` and `down` already
  sit in the same `exits` list with the same `UnavailableReason`. The row's own "Nearest
  today" cell says so ("keys already allow it").

Failure scenario: the contract developer reads the one `must` row as the one thing
blocking P5 and spends the slice on a change the schema does not need.

Fix (one line): delete row 1 and move "up/down exits" into the "already covers" sentence
at line 26; with no `must` rows left, drop the "Must" definition sentence too.

### F2 (should-fix) `docs/design/room-view/README.md:26`

The needs list lives in three places with three numberings. `explorations/lantern-loop.html:208`
carries "GameView needs" items 1-11; `room-view.html:247-255` carries "GameView needs, new
this round" items 16-20, which "add to items 1-15 from earlier rounds" and cite "item 14",
yet items 12-15 exist nowhere in the repository; the README table renumbers 1-12 and drops
the mock's items 18-19 (equipment projection, carrying summary) without saying so.
AGENTS.md: each fact lives in one place.

Failure scenario: a reader opens `room-view.html` (the README's first instruction), reads
its needs panel as current, looks for item 14 and finds nothing; or takes "equipment
projection" as a live need when the README, checked against the schema, does not list it.

Fix (one sentence, no HTML edit): after "first-pass notes" at line 26, state that the
needs panels inside the HTML pages are those first-pass notes and this table supersedes
them.

### N1 (nit) `docs/reference/README.md:3`

The header says "They stay in the archived legacy repository at `997a7a8`; they are not
copied here." The new bullet (line 19) is in-repo material, so the sentence is now false
for one bullet. Fix: "The legacy studies stay in ..." or an equivalent qualifier.

### N2 (nit) `docs/design/room-view/README.md:9-15`

"The chosen direction" departs from §4.10 in three places without naming them: the
drag-to-walk minimap replaces the six-way compass ring, pages replace the 2-6 action
sheet, and the position line (standing, sitting, resting) is not in §4.10 at all. Document
00 is on the spec's normative content pull list, so the amendment that adopts this
direction will need this list. Fix: one sentence naming the departures.

### N3 (nit) `docs/design/room-view/README.md:34`

Row 5's "Nearest today" says "UnavailableReason.code (only `exit_locked`)". True for the
typed code, but `UnavailableReason.message` (schema line 934) already exists for exactly
this case ("a locked door, a causeway under the tide") on the player-facing side. Naming it
keeps the row honest about what is missing: only the typed distinction. Optional.

### Process note (not a finding)

The PR body does not include the ponytail result WORKFLOW.md step 3 asks for. For a
docs-only slice the question it would have answered is whether nine HTML files (293 KB)
need to be committed; the README's reason (retrace the choice) is adequate, so this does
not block.

## Not asked for

No redesign of the UI; the direction is the owner's call. No new links, fixtures or checks
beyond the two one-line edits above.

## Re-review: fix round 1 at `9cc66f6`

Scope: the fix commit only (`docs/design/room-view/README.md`, `docs/reference/README.md`)
and its direct callers (the reference index link, which is unchanged).

- **F1 verified.** The `must` row is gone; "`up`/`down` exits (ExitView directions are
  keys, with the same reasons)" joins the "already covers" sentence; the "Must" definition
  is replaced by "None of the gaps below blocks the Lantern loop by touch", which matches
  the proof map; the header reads "Need (nice to have)" and rows 1-11 are the old rows
  2-12 in order, with no other text referencing the old numbers.
- **F2 verified.** "This table supersedes the numbered notes panels inside the HTML pages,
  which are the first-pass drafts." No HTML edit, as asked.
- **N1 verified.** `docs/reference/README.md:4` now scopes "not copied here" to "The legacy
  studies below"; the design bullet at line 19 no longer contradicts it.
- **N2 verified.** New "Departures from 00 §4.10" section names the three departures
  (joystick for the compass ring, pages for action sheets, position and current/max
  resources new) and says adopting them needs a spec amendment. Informative stance intact.
- **N3 verified.** Row 4 now says the player-facing `message` already tells a door from a
  barred way and asks only for the typed distinction.
- `mise exec -- elixir bin/check_docs.exs` at `9cc66f6`: 75 docs, 0 broken, 0 unreachable.

**Verdict: APPROVE.** Nothing open.
