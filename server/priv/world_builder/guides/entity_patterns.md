# Entity Patterns

Patterns for creating rooms, NPCs, items, and other game entities.

## Room Patterns

### The Hub Room

Central location players return to frequently.

```yaml
key: village_square
name: Village Square
description: |
  A cobblestone plaza where five streets converge. The well at the center
  has worn grooves from generations of rope. Market stalls crowd the
  northern edge.

  The clang of the blacksmith's hammer carries from the east. Children's
  laughter drifts from somewhere you can't quite place.
tags: [outdoor, safe_zone, hub]
```

**Characteristics:**
- Multiple exits (5+)
- Contains or near important NPCs
- Safe from combat
- Distinctive landmarks for navigation

### The Transition Room

Bridges between distinct areas.

```yaml
key: forest_edge
name: Forest's Edge
description: |
  The cultivated fields give way to wild undergrowth. A worn path
  disappears into shadow beneath the first trees.

  Behind you, the village smoke rises. Ahead, only birdsong.
tags: [outdoor, transition]
```

**Characteristics:**
- 2-3 exits
- Sensory contrast between zones
- Often contains warnings or hints
- May have guardian NPC or locked exit

### The Discovery Room

Contains significant revelation or item.

```yaml
key: hidden_shrine
name: Forgotten Shrine
description: |
  Moss has claimed the stone walls, but the carved symbols remain
  legible. An altar holds a single object, untouched by time or decay.

  The air is still. Expectant.
tags: [indoor, discovery, quest_location]
```

**Characteristics:**
- Usually single exit (makes finding it meaningful)
- Contains quest item or revelation
- Atmosphere of significance
- Often hidden or locked initially

### The Atmosphere Room

Exists primarily for worldbuilding/mood.

```yaml
key: overgrown_garden
name: Overgrown Garden
description: |
  What was once a formal garden has surrendered to wildness. Rose
  bushes have grown into thickets. A fountain, dry for years, is
  home to a thriving moss colony.

  Stone benches remain, their inscriptions still readable. Someone
  tended this place once.
tags: [outdoor, atmosphere, explorable]
```

**Characteristics:**
- Optional to visit
- Rewards exploration with lore/mood
- May contain hidden items
- Often connects to side stories

## NPC Patterns

### The Mentor

Provides guidance and exposition.

```yaml
key: elder_thoma
name: Elder Thoma
description: |
  His beard reaches his chest, more grey than white. Wrinkles
  map decades of weather and worry. His eyes, though, remain
  sharp—missing nothing.
level: 10
tags: [friendly, mentor, quest_giver]
room_key: village_square
```

**Characteristics:**
- Higher level (commands respect)
- Patient dialogue style
- Knows history/lore
- May have hidden past
- Provides quests or training

### The Reluctant Helper

Assists player but with reservations.

```yaml
key: blacksmith_ren
name: Ren the Smith
description: |
  Arms corded with muscle, face permanently flushed from the forge.
  She speaks in clipped sentences, attention always half on her work.
level: 5
tags: [merchant, craftsman, reluctant_ally]
room_key: smithy
```

**Characteristics:**
- Useful skills/items
- Resistant dialogue (player must earn trust)
- Personal concerns that conflict with helping
- Arc involves warming to player

### The Hidden Threat

Appears friendly, conceals danger.

```yaml
key: traveling_merchant
name: Silk
description: |
  Everything about the merchant is smooth—movements, voice, smile.
  His wares gleam in cases lined with velvet. He remembers every
  customer's name.
level: 8
tags: [merchant, hidden_threat]
room_key: market_stall
```

**Characteristics:**
- Charming or helpful initially
- Subtle wrongness in description
- Later reveals true nature
- Often connected to main antagonist

### The Comic Relief

Provides levity without undermining story.

```yaml
key: stablehand_pip
name: Pip
description: |
  Straw in hair. Hay on clothes. A gap-toothed grin that arrives
  before his words do. The horses love him; the stable cats tolerate him.
level: 1
tags: [friendly, comic, side_quest]
room_key: stables
```

**Characteristics:**
- Lower stakes interactions
- Genuine warmth
- May have surprisingly useful information
- Provides emotional relief between tense scenes

## Item Patterns

### The Quest Item

Required for progression.

```yaml
key: ancient_key
name: Ancient Key
description: |
  Heavier than it looks. The metal is warm to the touch, and the
  teeth form a pattern you almost recognize.
item_type: key
tags: [quest, unique]
```

**Characteristics:**
- Cannot be sold/dropped once obtained
- Clear visual distinctiveness
- Often has lore significance beyond function

### The Meaningful Artifact

Carries narrative weight.

```yaml
key: liras_pendant
name: Worn Pendant
description: |
  A silver disk on a tarnished chain. The engraving has worn smooth
  from handling. It smells faintly of lavender.
item_type: misc
tags: [artifact, story]
```

**Characteristics:**
- Connected to character/story
- Description changes as story progresses
- May have mechanical use later
- Emotional significance

### The Resource

Consumed for mechanical benefit.

```yaml
key: healing_moss
name: Twilight Moss
description: |
  Grows only in shadow. Soft as velvet, cool to touch. Tastes
  of mint and something metallic.
item_type: consumable
tags: [healing, common]
```

**Characteristics:**
- Stackable
- Clear mechanical purpose
- Description adds worldbuilding
- Available in multiple locations

## Connection Patterns

### The Sensory Trail

Exits hint at destination through senses.

```
North: The sound of running water grows louder
South: Woodsmoke and the murmur of voices
East: A narrow path disappears into thorns
West: Open sky visible through thinning trees
```

### The Locked Path

Exit requires key/condition.

```yaml
exits:
  down:
    destination: cellar
    locked: true
    key: rusty_cellar_key
    locked_message: "The trapdoor is secured with a heavy padlock"
```

### The Hidden Exit

Not obvious until triggered.

```yaml
exits:
  northwest:
    destination: secret_grove
    hidden: true
    reveal_condition: quest_active:find_the_grove
    reveal_message: "Following the marks on the trees reveals a hidden path"
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Empty connector rooms | Every room has purpose |
| All NPCs friendly | Include tension/conflict |
| Item = function only | Add lore/personality |
| Hidden exits with no hints | Subtle clues exist |
| Forgettable descriptions | Distinctive details |
