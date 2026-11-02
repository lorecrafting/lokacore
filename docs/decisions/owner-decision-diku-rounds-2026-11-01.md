# Owner decision: Diku rounds — 2026-11-01

Written 2026-11-01 by the developer of Beads `loka-kgd.197`, from the PM's relay of the owner's words.
Paraphrased words are marked; the LegendMUD log and the showcase line are verbatim.

Owner, 2026-11-01 (paraphrased): combat should read like a Diku MUD round. After a round the player sees
no HP numbers, only the foe's condition, as in "Maile, the dragon slayer has some cuts." The PM's brief
(Beads `loka-kgd.197`) reads the log below as: Attack strikes at once, lines name who struck whom, and
the words grow with the blow.

Owner, 2026-11-01 (verbatim): "There's an initiative roll involved for who attacks first."

The owner's LegendMUD log (verbatim):

```
A wretched troll-faced rodent-woman quickly attacks and hits 5 times.
A wretched troll-faced rodent-woman decimates Ladyr with her powerful slash!
You quickly attack 9 times and hit 6 times.
You assault a wretched troll-faced rodent-woman with an astonishing pierce.
```

Owner, 2026-11-01 (verbatim): "please opt in for the showcase, this way we discussed of combat". This
lifts the showcase freeze for combat only: `cartridges/toolbox_showcase` declares
`world.combat.initiative`, `tiers` and `conditions`.

Owner, 2026-11-01 (verbatim), asking the PM to write the showcase's combat words: "Can you please do this
for me, and follow LegendMUD as much as possible". This is an owner exception to the rule that the owner
writes every player-facing word, for the showcase's combat lines only; the PM wrote them and the owner's
request approves them. Condition lines are a separate list, not the condition bands, whose words stay the
player's status line; a name that opens a line is capitalised.

## Effect

[Diku rounds](../system/mechanics.md#diku-rounds-loka-kgd197) state the rules and
[declarations](../system/cartridge.md#diku-rounds) the keys. Multi-swing summaries ("hits 5 times") are
Beads `loka-kgd.198`; skill rounds are `loka-kgd.199`. The owner writes every line; the showcase's
combat lines are the PM's, at the owner's request above.
