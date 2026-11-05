# Review: status line icons, PR #613 (loka-15g, loka-kgd.7)

- PR [#613](https://github.com/lorecrafting/lokacore/pull/613) `design/status-lines` at `672f8f8ba42d3d4c3f6298677c7e4cbdf3975577`.
- Governing: [status-line rulings](../design/status-line-rulings.md), [book-ui.md](../system/book-ui.md) Combat and Conditions, the `StatusIcon.tsx` doc comment, [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work. Book UI with no contract change: the [two-lane rule](../decisions/owner-decision-two-lane-ci-2026-10-09.md) would ask only for a PR comment, but the PM asked for this record.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. Bleeding is the first icon, then debuffs, then neutral conditions, then buffs.
2. Up to six icons show. With seven or more, five show, followed by a +N disc.
3. The +N tip and its accessible name list exactly the hidden labels.
4. The bleeding icon is named by its label, the time left, the cadence and "debuff".
5. An icon pushed behind the disc neither pops nor fades. An arrival behind the disc does not pop.
6. In spirit and in reverie, the row is hidden.
7. The five prologue states fit on one line at 360 px.
8. The Character page keeps the full bleeding line and the full condition lines.

## Checks that held

- (1)–(3) Order and the cap are correct for mixed sets. These hand mutants were each red in the stories: swapping neutral and buff (Six, Overflow); `items.slice(shown+1)` (Overflow); `CAP` 6→7 (mutate_diff `:41`).
- (4) StatusLine Bleeding has the name "bleeding, 37s remaining, 1 HP each 60s, debuff, opens Character".
- (5) Dropping `p.hidden ||` from the cue guard is red in `effects_press`.
- (6) Covered in `keyboard.test.ts`, with a positive control.
- (7) PrologueNarrow is consistent with the ruling.
- Tooltip as the first child: on native it is absolute at `bottom: size.touch`, has `pointerEvents` none and is aria-hidden. It overlaps no icon, so moving it first causes no native regression.
- mutate_diff at the head: 27 run. 21 red-narrow, 6 SURVIVED, 1 NO-TESTS (`preview.tsx:128`).
  - `:124` and `:172` are cleared by the developer's hand mutants.
  - `:75`, `:79` and `:138` are equivalent.
  - `model.ts:20` is the old clamp carried over; it only differs at 0 s left.

## Findings

1. **should-fix**, `mobile/app/book/sections.tsx:67`. Character shows only the label ("Bleeding"). This slice removed the time and cadence from the status line, so they are now on no sighted surface. The ruling says "Character keeps the full bleeding … lines". Fix: render `cap(bleedingParts(...).join(' · '))` and add one assertion.
2. **nit**, `mobile/app/book/Status.tsx:76-77`/`:221`. The position-ellipsis rule cannot be reached.
   - Narrow with `weather: 'freezing_fog'` at 360 px / Max did not truncate ("expected 67 to be greater than 67").
   - Removing `numberOfLines={1}` stays green.
   - Either trim the doc rule or keep a fixture that reaches it.

## Rulings on open items

- (a) Should-fix in this slice: finding 1.
- (b) Nit: finding 2. Dropping the check was correct, since it was unreachable.
- (c) Accept. Hidden icons stay mounted (`StatusIcon.tsx:298`), because unmounting would fire FadeOut, which the ruling forbids. Hidden icons are out of the accessibility tree (Overflow story).
- (d) Accept. `:75`, `:79` and `:138` are equivalent.
