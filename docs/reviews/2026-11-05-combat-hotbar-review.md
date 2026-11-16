# Review: Combat hotbar, the Inked strip under the Combat page (loka-x6t.136)

- PR: #661 `book/hotbar`
- Reviewed commit: `6cf613676f8f3fa908ad72f4e24677baaa82a779` (main merged over `7c58452a7`)
- Governing: [book-ui.md, Combat hotbar](../system/book-ui.md#combat-hotbar);
  [icon-style-guide](../design/icon-style-guide.md); designer brief (loka-x6t.131, last comment, six tests);
  engine data from #658 (`ends_at`/`duration` on a cooling entry, `interval` on `CombatView`);
  [WORKFLOW review stance](../WORKFLOW.md#review-stance); owner: author-side guards are nits, accessibility is not
- Independence: Fable reviewer, authored none of the slice; one detached worktree at the head for mutants and the
  focused story run; no servers started (shared machine), no web walk
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- PM calls applied, not re-litigated: aimed spells stay in the foe's list; no skill and no word = no strip

## Must be true (written before the diff)

1. Inked look only: `fg` disc, `bg` glyph, `dim` disc when cooling or barred, wedge from 12 clockwise over the
   elapsed share with `bg` seams; barred = no wedge; every size a token (canvas 52, disc 44, glyph box 28, gap
   `space.xl`, padding `space.lg`); opener is three dots on the midline, never cooling or barred.
2. Fixed strip at the Combat page's bottom; drawn only when a skill or word fills a slot; three slots in GameView
   order (untargeted scripted actions, then unaimed spell words), barred ones keep their place; empty slots are
   hairline rings, not focusable, no name; the fourth slot is the opener.
3. The opener's list is the Combat page's one open list: it closes a foe's list and a foe's list closes it; a row
   press sends and closes unless pending; Escape or a second press closes it with focus back on the opener.
4. A ready press commits the same `Button` the foe lists would; a barred or cooling press sends nothing and reads
   the reason once; no caption, the accessible name is the key word plus the state.
5. Cooldown: `share = (time − (ends_at − duration)) / duration` clamped; the wedge tweens no further than the gap
   since the last view; reduced motion steps; the screen reader hears rounds left `ceil((ends_at − time)/interval)`,
   and a cooling entry with no pair reads as barred with its reason and no count.
6. Checks: glyph frame (ink 3..21, at most four subpaths) and missing drawing over the showcase's skill and spell
   word keys, each red on a plant; no raw value in the hotbar files.

## Checks that held

- Items 1, 2, 4 and the drawing half of 5 hold: `Hotbar.tsx:36-64` (`slotsOf`), `:88-120` (`SlotButton`),
  `HotbarGlyph.tsx` tokens and wedge path; stories `Hotbar`, `HotbarFew`, `HotbarOpen` pass (focused vitest run,
  12 tests); `role="group"` reaches the web as a named group (the stories assert it).
- `bin/mutate_diff.sh origin/main` (own run): 59 mutants, 52 red-narrow, 5 SURVIVED, 2 NOT-UNIQUE, exit 1; the PR's
  equivalent-survivor list matches (`Hotbar.tsx:39`, `HotbarGlyph.tsx:102`, `:105`, `specs.ts:23`); `Combat.tsx:129`
  survives there by the one-hop rule only.
- Hand mutants against `book/hotbar.test.ts` (baseline 8 pass): `Combat.tsx:129 && → ||` red (PR claim holds);
  `Hotbar.tsx:44 commandOf → action_key` red (claim holds); slot order reversed red; `:105` reason word dropped
  red; planted glyph `M2 2L22 22` red; `ward` drawing removed red; `catalogue.test.ts` without the `specs.ts` hunk
  red (claim holds, 2 fail).
- Hand mutants the suite keeps green: `Hotbar.tsx:163` second opener press never closes; `:195` no focus back to
  the opener; a planted showcase non-spell action with no drawing (see S2).

## Findings

### Should-fix

- **S1. No rounds-left count for the screen reader** (`Hotbar.tsx:105`; `view.combat.interval` is never read).
  Spec [Cooldown timing](../system/book-ui.md#combat-hotbar): the count is `ceil((ends_at − time)/interval)`. A
  VoiceOver user on a cooling slot hears "ward, cast, cooldown" and nothing of how long. `accessibilityValue
  {min: 0, max: ceil(duration/interval), now: rounds}` as `Unavailable.tsx:105` does for a wait needs no new
  player word; `fight()` in the test already carries `interval: 150`, so one assertion in the cooling test pins it.
  Not an author-side nit (accessibility).
- **S2. The missing-drawing check covers spell words only** (`hotbar.test.ts:290-293` filters
  `t?.kind === 'spell' && !t.aimed`). Style guide [proposed checks](../design/icon-style-guide.md#proposed-checks-developer-slice)
  says every skill and spell word key; `commands/actions.ts:115-132` maps every non-`use` scripted action to
  target `none`, so a showcase action such as `shout_begone_cellar` fills a slot with the neutral mark and the check
  stays green (planted, confirmed). Widen the glob's filter to the same predicate `slotsOf` uses, or list the
  showcase's untargeted actions as fallback on purpose.
- **S3. Opener close and focus return unpinned** (`Hotbar.tsx:162-164`, `:193-196`). Spec: "Escape or a second
  press closes it" with focus back on the opener. Both hand mutants stay green; two asserts in the test at `:166`
  (press twice → `aria-expanded` false; after close `document.activeElement` is the opener) kill them. Small; may
  ride with S1.

### Nits

- `LABEL.wordCast` (`labels.ts`) duplicates the `` `${word}, cast` `` literal at `skills.tsx:197` and `:223`; one
  source for the name.
- `slotsOf` runs in `Hotbar` (`:135`) and again in `HotbarList` (`:185`) on every view; pass the slots down or
  accept the recompute with a one-line why.
- The developer's own open items: `:58` token from `buttons[0]` is equivalent (one token per cast list); `:77` 0×0
  empty slot without Skia matches `StatusIcon`/`UnderInk`'s `canDraw()`; `:140` list open while fillers vanish is
  the PickList `useFocus` rule; `:95` `said` never reset matches `Unavailable.tsx:53`; `:47` key collision is
  author error.

## PM questions

- Scripted-verbs branch in fights: live, not dead. The kernel advertises `perform` during combat
  (`view/combat.ts` gates only move/flee/shoo/attack); the showcase just has no plain untargeted skill, and its
  detail-bound ones reach the slot as target `none` (hence S2).
- PickList unavailable rows: `HotbarList` rows carry `{label, reason}` (`Hotbar.tsx:185-189`), so an unavailable
  row is the unavailable form with its sentence, same as a foe's list.
- `noctis` has no drawing: it lives in `spells_sampler`, outside the showcase check by design; the story documents
  the neutral mark (style guide recipe step 6).
- `LABEL.hotbar` and `hotbarOpener` are `~`; `wordCast` composes the key word with the existing ", cast" that
  `skills.tsx` already shows, not a new player word.
- `stories/specs.ts` change: needed; without it `catalogue.test.ts` fails on the hotbar's doc comments.

## Verdict

**APPROVE WITH NOTES**: one fix round for S1 and S2 (S3 and the nits may ride along); re-check appended here.
