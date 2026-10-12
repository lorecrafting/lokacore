# Review: toolbox row 28, cursed items and blessing (loka-kgd.97)

- Branch `toolbox/m9-curse`, head `53f0b6c4d37d80919b054d8f8bce39e0048117e3`, diffed against `9a11cef8` (`toolbox/batch-m9`). No PR (batch model). Installed `kernel_api` 1.66, no floor.
- Governing: [Cursed items and blessing](../system/mechanics.md#cursed-items-and-blessing-toolbox-row-28) (added here), [equipment@1](../system/mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets), [SR4](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5), [W6](../system/mechanics.md#entity-description-variants-toolbox-row-w6), toolbox row 28, Beads `loka-kgd.97`. PM ruling not reopened (2026-10-11): the curse is hidden until worn; a blessing lifts it and the player keeps the item.
- Hosted ci and book-e2e were in progress on the head at writing (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; three doc nits).
- Written 2026-10-12 03:31 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12e09; line backfilled 2026-10-12).

## Must be true

1. A worn item whose own active statuses bar `remove` is refused `invalid_state` and not listed; step and GameView share one check, so `gameview_agrees_with_admission` holds.
2. Wear, the wearer's own SR4 reads and every other code are unchanged; no other player path moves a worn item out of a slot holder around the check.
3. The curse shows nothing while carried (name, description, Conditions); it shows once worn.
4. The blessing cures the curse on the item; the item stays worn and may then be removed; a blessed item is not cursed again.
5. No mechanic names this content; cartridges without such a status keep their behaviour.

## Proof

- Green at head: TS `curse`, `equipment`, `affects`, `exposure`, `combat_actions` (26 pass).
- Mutants (reverted), against `curse` and `equipment`: check dropped (`equipment/rule.ts:61`) red; `statusAllows(world, body)` (reads the wearer) red; the check moved ahead of the worn branch, so it also bars wear, red (`wear` rejected). Content: the `wearing` leaf dropped from the ring's name variant red ("hidden while carried"); the curse reaction's blessed `when` removed red ("not cursed again"); `cursed` set to `blocks: [drop]` red. Survivors: none.
- Other remove paths: every `entity.transfer` site checked. Drop, give, put, sell (`commerce/shared.ts:54`), eat (`food/shared.ts`), dialogue exchange and bandage all need the item directly in the body; death custody moves worn items on purpose (`death/sequence.ts:184`, as the spec says). No bypass.
- Cites rerun: the GameView lists `remove` through `equipment.transfer` (`view/action_lists.ts:246`); Conditions show only `world.body` (`view/resources.ts:50`), so a carried cursed ring shows no condition; the invariant's equipment branch refuses an unlisted accepted `remove` (`view/invariants_view.ts:61`).
- No floor: matches the "no field, so no floor" precedent (status reader 4 NPC movement, the 1.60 spell kill credit) and the [forward-development decision](../decisions/owner-decision-forward-development-2026-10-05.md); an older kernel refuses the `cursed` tag through the closed `Tag` enum, and only `ward_sampler` declares `blocks`/`allows`, applied to no item, which bears out "no cartridge before this row".
- Tests: literal expected values; the header names three breaks, each made red above. Elixir: no code changed; tags come from the schema only.

## Findings

1. **nit**, `protocol/entity.schema.json:336` and `docs/system/mechanics.md:2394`: "No mechanic reads cursed" is not quite true. G2 sums resistances for a wielded weapon's tags (`combat/round_attack.ts:106`, `:233`), and `Resistances` gains a `cursed` key. Scenario: a cursed sword against an NPC with `cursed: 50` deals half damage, which the spec says cannot happen. Fix: "gives it no meaning of its own (as any tag, `has_tag` and G2 resistances still see it)".
2. **nit**, `docs/system/mechanics.md:2394` known limit: the tag is static, so a blessed ring that is still worn keeps the `wearing {tag: cursed}` leaf true. Any carried item still under its curse then shows its cursed name. Fix: "while any item tagged `cursed` is worn, even a blessed one".
3. **nit**, `docs/system/mechanics.md:2398`: "designer to approve" with no Beads designer item. A worn ring that silently loses Remove (with no line on a refused try) is the kind of UX the designer should see. Fix: cite or open a `loka-x6t` item.

## PM dispositions (fix b241b914)

Written 2026-10-12 03:31 UTC in the Pi harness by anthropic/claude-opus-5-5 (PM, Pi session 01a12e09; line backfilled).

Doc-only nit fix, so no re-review agent ([workflow step 6](../WORKFLOW.md#loop)); the PM checked the diff touches only `docs/system/mechanics.md`, the `Tag` description in `protocol/entity.schema.json` and its generated copies.

1. Fixed: `Tag` and the row 28 section say no mechanic gives `cursed` a meaning of its own; `has_tag`, `wearing` and resistances see it as any tag.
2. Fixed: the W6 known limit now says the tag stays after a blessing, so any worn `cursed`-tagged item, even a blessed one, reveals a carried cursed item.
3. Fixed: the Book line cites Beads `loka-x6t.38` for the designer decision on a missing or refused Remove.
