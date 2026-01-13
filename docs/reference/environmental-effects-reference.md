# Environmental Effects Reference

A comprehensive catalog of all biomes, climate zones, weather effects, and environmental phenomena for future implementation.

## Implementation Status Legend

- ✅ Implemented
- 🚧 In Progress
- 📋 Planned
- 💭 Future Consideration

---

## 1. BIOMES

### Terrestrial Biomes

| Biome | Key | Status | Visual Signature | Particle Effects |
|-------|-----|--------|------------------|------------------|
| Temperate Forest | `forest` | 📋 | Dappled green light, brown earth | Falling leaves, fireflies |
| Boreal/Taiga | `taiga` | 💭 | Blue-green pines, snow-dusted | Snow particles, owl calls |
| Tropical Rainforest | `rainforest` | 💭 | Deep green, humid haze | Constant drip, exotic birds |
| Temperate Rainforest | `temperate_rain` | 💭 | Mossy green, misty | Fern fronds, fog |
| Savanna/Grassland | `savanna` | 💭 | Golden grass, vast sky | Waving grass, heat shimmer |
| Prairie/Steppe | `prairie` | 💭 | Endless grass, big sky | Wind waves, hawk silhouette |
| Hot Desert | `desert_hot` | 💭 | Tan/orange sand, harsh white sun | Blowing sand, mirages |
| Cold Desert | `desert_cold` | 💭 | Gray rock, clear air | Frost crystals, wind |
| Tundra | `tundra` | 💭 | Gray-brown, low vegetation | Aurora, lichen |
| Alpine/Mountain | `mountain` | 📋 | Gray rock, snow, thin air | Eagles, echoes, mist |
| Chaparral | `chaparral` | 💭 | Brown/tan scrub, dry | Dust, aromatic shimmer |
| Bamboo Forest | `bamboo` | 💭 | Green vertical lines | Creaking sounds |

### Aquatic/Water Biomes

| Biome | Key | Status | Visual Signature | Particle Effects |
|-------|-----|--------|------------------|------------------|
| Open Ocean | `ocean` | 💭 | Deep blue, rolling horizon | Spray, seabirds |
| Coastal | `coastal` | 💭 | Blue-green, white foam | Waves, gulls |
| Coral Reef | `reef` | 💭 | Vibrant colors, clear blue | Fish schools, bubbles |
| Deep Sea | `deep_sea` | 💭 | Black, bioluminescence | Glowing creatures |
| Lake | `lake` | 💭 | Still blue/green, reflections | Ripples, loons |
| River | `river` | 📋 | Moving blue, smooth stones | Current lines, splash |
| Wetland/Marsh | `marsh` | 📋 | Green reeds, still water | Frogs, dragonflies |
| Swamp | `swamp` | 💭 | Murky green, hanging moss | Fireflies, mist |
| Bog | `bog` | 💭 | Brown water, spongy | Will-o-wisps |
| Hot Springs | `hot_springs` | 💭 | Mineral colors, steam | Rising steam |

### Underground Biomes

| Biome | Key | Status | Visual Signature | Particle Effects |
|-------|-----|--------|------------------|------------------|
| Limestone Cave | `cave` | 📋 | Gray/brown, dripping | Water drops, echoes |
| Lava Tube | `lava_tube` | 💭 | Black glass, warm glow | Heat shimmer |
| Ice Cave | `ice_cave` | 💭 | Blue-white, crystalline | Ice particles |
| Crystal Cave | `crystal_cave` | 💭 | Prismatic light | Light refraction |
| Underwater Cave | `underwater_cave` | 💭 | Blue-green filtered light | Bubbles |
| Mine | `mine` | 💭 | Brown timber, ore glints | Dust motes |
| Fungal Cavern | `fungal` | 💭 | Bioluminescent blues/greens | Spores |

### Transitional Biomes

| Biome | Key | Status | Visual Signature | Particle Effects |
|-------|-----|--------|------------------|------------------|
| Beach | `beach` | 💭 | Tan sand, blue water | Waves, shells |
| Cliff | `cliff` | 💭 | Gray rock, vast view | Wind, nesting birds |
| River Delta | `delta` | 💭 | Braided waterways | Waterfowl |
| Treeline | `treeline` | 💭 | Stunted trees, exposed rock | Wind |
| Oasis | `oasis` | 💭 | Palm shade, still water | Relief shimmer |
| Meadow | `meadow` | 📋 | Wildflowers, soft grass | Butterflies, bees |
| Waterfall | `waterfall` | 💭 | White cascade, mist | Rainbow, constant spray |

### Fantasy/Magical Biomes

| Biome | Key | Status | Visual Signature | Particle Effects |
|-------|-----|--------|------------------|------------------|
| Enchanted Forest | `enchanted` | 💭 | Glowing plants, ethereal | Floating motes, whispers |
| Corrupted Land | `corrupted` | 💭 | Sickly greens/purples | Miasma, decay |
| Ethereal Plane | `ethereal` | 💭 | Translucent, shimmering | Time distortion |
| Shadow Realm | `shadow` | 💭 | Muted grays, creeping dark | Moving shadows |
| Fey Realm | `fey` | 💭 | Impossible colors | Music notes, sparkles |
| Elemental Plane | `elemental_*` | 💭 | Dominant element visuals | Element particles |
| Void | `void` | 💭 | Pure darkness | Nothing |
| Dream Realm | `dream` | 💭 | Shifting, surreal | Morphing shapes |
| Bardo Realm | `bardo` | 📋 | Otherworldly, symbolic | Spirit wisps |

---

## 2. CLIMATE ZONES

### Temperature Classifications

| Zone | Key | Temperature | Visual Palette |
|------|-----|-------------|----------------|
| Tropical | `tropical` | Hot year-round | Vibrant greens, bright |
| Subtropical | `subtropical` | Warm | Lush greens, golden |
| Temperate | `temperate` | Moderate | Seasonal variation |
| Continental | `continental` | Extreme seasons | Strong seasonal shifts |
| Subarctic | `subarctic` | Cold | Blue-grays, muted |
| Polar | `polar` | Always cold | White, pale blue |

### Moisture Classifications

| Zone | Key | Precipitation | Visual Palette |
|------|-----|---------------|----------------|
| Arid | `arid` | Very dry | Tan, brown, harsh light |
| Semi-Arid | `semi_arid` | Dry | Muted yellows, sparse |
| Subhumid | `subhumid` | Moderate | Greens with brown |
| Humid | `humid` | Wet | Rich greens |
| Perhumid | `perhumid` | Very wet | Deep greens, mist |

### Altitude Zones

| Zone | Key | Elevation | Visual Changes |
|------|-----|-----------|----------------|
| Lowland | `lowland` | 0-500m | Base climate |
| Montane | `montane` | 500-1500m | Cooler colors |
| Subalpine | `subalpine` | 1500-2500m | Sparse trees, gray |
| Alpine | `alpine` | 2500-4000m | Rock, snow |
| Nival | `nival` | >4000m | Permanent snow |

---

## 3. WEATHER EFFECTS

### Precipitation

| Weather | Key | Status | Visual Effect | Sound | Gameplay |
|---------|-----|--------|---------------|-------|----------|
| Light Rain | `rain_light` | 📋 | Gentle streaks, ripples | Soft patter | Mood |
| Heavy Rain | `rain_heavy` | 📋 | Dense streaks, splashes | Drumming | Visibility -30% |
| Downpour | `rain_downpour` | 💭 | Wall of water | Roaring | Visibility -50% |
| Drizzle | `drizzle` | 💭 | Fine mist | Whisper | Dampness |
| Sleet | `sleet` | 💭 | Mixed rain/ice | Clicking | Slippery |
| Light Snow | `snow_light` | 📋 | Gentle flakes | Silence | Tracks visible |
| Heavy Snow | `snow_heavy` | 💭 | Dense whiteout | Wind | Visibility -50% |
| Blizzard | `blizzard` | 💭 | Horizontal snow | Screaming | Visibility -80% |
| Hail | `hail` | 💭 | Bouncing ice | Clatter | Damage |
| Freezing Rain | `freezing_rain` | 💭 | Clear then ice | Cracking | Slippery |

### Sky Conditions

| Condition | Key | Status | Visual Effect | Light Level Modifier |
|-----------|-----|--------|---------------|---------------------|
| Clear | `clear` | ✅ | Blue/black sky | 1.0 |
| Few Clouds | `clouds_few` | 💭 | Scattered puffs | 0.95 |
| Partly Cloudy | `clouds_partial` | 💭 | Mixed coverage | 0.85 |
| Mostly Cloudy | `cloudy` | ✅ | Gray coverage | 0.7 |
| Overcast | `overcast` | 💭 | Uniform gray | 0.6 |
| Broken Clouds | `clouds_broken` | 💭 | God rays | Variable |

### Wind

| Intensity | Key | Status | Visual Effect | Sound |
|-----------|-----|--------|---------------|-------|
| Calm | `wind_calm` | ✅ | Still | Silence |
| Light Breeze | `wind_light` | 💭 | Leaves rustle | Whisper |
| Moderate Wind | `wind_moderate` | 💭 | Branches sway | Whooshing |
| Strong Wind | `wind_strong` | 💭 | Trees bend | Howling |
| Gale | `wind_gale` | 💭 | Violent motion | Roaring |
| Storm Force | `wind_storm` | 💭 | Destruction | Screaming |

### Fog/Visibility

| Type | Key | Status | Visual Range | Effect |
|------|-----|--------|--------------|--------|
| Light Haze | `haze` | 💭 | 1-5 km | Distant blur |
| Moderate Fog | `fog` | ✅ | 200m-1km | Muffled, mysterious |
| Dense Fog | `fog_dense` | 💭 | 50-200m | Shapes loom |
| Ground Fog | `fog_ground` | 💭 | Ground level | Feet hidden |
| Sea Fog | `fog_sea` | 💭 | Coastal | Salty, cool |

### Electrical/Storm

| Effect | Key | Status | Visual | Sound |
|--------|-----|--------|--------|-------|
| Distant Lightning | `lightning_distant` | 💭 | Horizon flashes | Rumble |
| Sheet Lightning | `lightning_sheet` | 💭 | Sky illumination | Low rumble |
| Fork Lightning | `lightning_fork` | 📋 | Branching bolts | Crack/boom |
| Thunder | `thunder` | 📋 | None | Rolling boom |

### Temperature Extremes

| Condition | Key | Status | Visual Effect |
|-----------|-----|--------|---------------|
| Heat Wave | `heat_wave` | 💭 | Shimmer, mirages |
| Scorching | `scorching` | 💭 | Cracked earth |
| Freezing | `freezing` | 💭 | Frost forming |
| Bitter Cold | `bitter_cold` | 💭 | Ice crystals |

### Rare Weather Events

| Event | Key | Status | Rarity | Visual |
|-------|-----|--------|--------|--------|
| Aurora Borealis | `aurora` | 💭 | Polar nights | Green/purple curtains |
| Sandstorm | `sandstorm` | 💭 | Desert | Brown wall |
| Dust Devil | `dust_devil` | 💭 | Hot/dry | Small spiral |
| Waterspout | `waterspout` | 💭 | Coastal | Water tornado |
| Double Rainbow | `rainbow_double` | 💭 | After rain | Two arcs |
| Sun Dog | `sundog` | 💭 | Ice crystals | Twin false suns |
| Moon Halo | `moon_halo` | 💭 | High clouds | Ring around moon |

---

## 4. CELESTIAL EVENTS

### Solar Events

| Event | Key | Status | Timing | Visual |
|-------|-----|--------|--------|--------|
| Sunrise | `sunrise` | ✅ | Dawn start | Golden rays, pink sky |
| Sunset | `sunset` | ✅ | Dusk start | Amber/purple/red |
| High Noon | `noon` | 💭 | Midday | Harsh shadows |
| Golden Hour | `golden_hour` | 💭 | Near sunrise/set | Warm side-light |
| Blue Hour | `blue_hour` | 💭 | Twilight | Cool blue |
| Solar Eclipse | `eclipse_solar` | 💭 | Rare | Darkness, corona |

### Lunar Phases

| Phase | Key | Status | Illumination | Night Effect |
|-------|-----|--------|--------------|--------------|
| New Moon | `moon_new` | 📋 | 0% | Darkest, stars bright |
| Waxing Crescent | `moon_wax_crescent` | 📋 | 1-49% | Slight glow |
| First Quarter | `moon_first_quarter` | 📋 | 50% | Moderate light |
| Waxing Gibbous | `moon_wax_gibbous` | 📋 | 51-99% | Bright |
| Full Moon | `moon_full` | 📋 | 100% | Silvery bright |
| Waning Gibbous | `moon_wan_gibbous` | 📋 | 99-51% | Still bright |
| Last Quarter | `moon_last_quarter` | 📋 | 50% | Rising late |
| Waning Crescent | `moon_wan_crescent` | 📋 | 49-1% | Pre-dawn |
| Lunar Eclipse | `eclipse_lunar` | 💭 | Blood red | Rare |
| Supermoon | `supermoon` | 💭 | Extra bright | Perigee |

### Stellar Events

| Event | Key | Status | Frequency | Visual |
|-------|-----|--------|-----------|--------|
| Shooting Star | `meteor` | 📋 | Common | Brief streak |
| Meteor Shower | `meteor_shower` | 💭 | Seasonal | Many streaks |
| Comet | `comet` | 📋 | Rare (~1/hour) | Visible tail |
| Milky Way | `milky_way` | 💭 | Dark sky | Band of stars |

---

## 5. SEASONAL VARIATIONS

### Seasons

| Season | Key | Status | Visual Palette | Weather Tendency |
|--------|-----|--------|----------------|------------------|
| Early Spring | `spring_early` | 💭 | Pale greens, buds | Rain, unpredictable |
| Late Spring | `spring_late` | 💭 | Bright greens, blooms | Warming, storms |
| Early Summer | `summer_early` | 💭 | Lush greens | Hot, humid |
| Late Summer | `summer_late` | 💭 | Golden, dry | Heat waves |
| Early Autumn | `autumn_early` | 💭 | Orange/red starting | Cooling, crisp |
| Late Autumn | `autumn_late` | 💭 | Brown, bare | Cold rain |
| Early Winter | `winter_early` | 💭 | First snow | Cold, snow |
| Late Winter | `winter_late` | 💭 | Deep snow | Bitter cold |

### Seasonal Particle Effects

| Season | Daytime Effects | Nighttime Effects |
|--------|-----------------|-------------------|
| Spring | Pollen drift, butterflies | Frog chorus |
| Summer | Heat shimmer, dragonflies | Fireflies, cicadas |
| Autumn | Falling leaves, bird migration | Harvest moon glow |
| Winter | Snowflakes, breath clouds | Aurora, crisp stars |

---

## 6. BIOLOGICAL PHENOMENA

| Phenomenon | Key | Status | Conditions | Visual |
|------------|-----|--------|------------|--------|
| Fireflies | `fireflies` | 📋 | Summer night, wetland | Blinking amber |
| Bioluminescence | `bioluminescence` | 💭 | Night, ocean/cave | Glowing blue-green |
| Bird Migration | `migration_birds` | 💭 | Spring/autumn | Flocks overhead |
| Butterfly Swarm | `butterflies` | 💭 | Spring, meadow | Colorful flutter |
| Frog Chorus | `frogs` | 💭 | Spring night, water | Sound only |
| Cicadas | `cicadas` | 💭 | Summer day | Sound only |
| Pollen Drift | `pollen` | 💭 | Spring | Yellow haze |
| Falling Leaves | `leaves_falling` | 💭 | Autumn | Spinning descent |
| Cherry Blossoms | `sakura` | 💭 | Spring | Pink petal rain |

---

## 7. NATURAL DISASTERS

| Event | Key | Status | Visual | Gameplay |
|-------|-----|--------|--------|----------|
| Earthquake | `earthquake` | 💭 | Screen shake | Damage, blocked paths |
| Volcanic Eruption | `eruption` | 💭 | Ash, lava glow | Evacuation |
| Avalanche | `avalanche` | 💭 | White wall | Flee or buried |
| Landslide | `landslide` | 💭 | Earth moving | Path blocked |
| Flash Flood | `flood` | 💭 | Sudden water | Swept away |
| Wildfire | `wildfire` | 💭 | Orange glow, smoke | Damage, evacuation |
| Tsunami | `tsunami` | 💭 | Wall of water | Coastal destruction |

---

## 8. MAGICAL/SUPERNATURAL EFFECTS

| Effect | Key | Status | Trigger | Visual |
|--------|-----|--------|---------|--------|
| Mana Storm | `mana_storm` | 💭 | High magic area | Arcane crackle |
| Spirit Manifestation | `spirits` | 💭 | Haunted location | Translucent figures |
| Planar Bleed | `planar_bleed` | 💭 | Thin barriers | Reality distortion |
| Wild Magic Surge | `wild_magic` | 💭 | Unstable magic | Random effects |
| Blessing Aura | `blessing` | 💭 | Sacred site | Golden glow |
| Curse Miasma | `curse` | 💭 | Cursed area | Sickly green fog |
| Temporal Anomaly | `temporal` | 💭 | Chronomancy | Time stuttering |
| Elemental Surge | `elemental_*` | 💭 | Elemental area | Element intensifies |
| Dream Leak | `dream_leak` | 💭 | Near dream realm | Surreal imagery |
| Void Incursion | `void_incursion` | 💭 | Near void | Darkness spreading |

---

## 9. LIGHT SOURCES

### Player-Carried

| Source | Key | Status | Light Radius | Visibility | Duration |
|--------|-----|--------|--------------|------------|----------|
| None | `none` | ✅ | 0 | 15% at night | - |
| Candle | `candle` | 📋 | Small | 45% | 1 hour |
| Torch | `torch` | 📋 | Medium | 70% | 30 min |
| Lantern | `lantern` | 📋 | Large | 100% | 4 hours |
| Magic Light | `magic_light` | 💭 | Medium | 100% | Mana cost |
| Glowstone | `glowstone` | 💭 | Small | 60% | Permanent |

### Environmental

| Source | Key | Status | Effect |
|--------|-----|--------|--------|
| Sunlight | `sunlight` | ✅ | Full visibility day |
| Moonlight | `moonlight` | 📋 | Partial at night |
| Starlight | `starlight` | 📋 | Minimal |
| Campfire | `campfire` | 💭 | Local bright area |
| Hearth | `hearth` | 💭 | Indoor warm light |
| Street Lamp | `streetlamp` | 💭 | Urban lighting |
| Bioluminescence | `bio_light` | 💭 | Cave/underwater |

---

## Implementation Priority

### Phase 1 - Core (Current)
- ✅ Day/night cycle
- 📋 Dynamic theme colors
- 📋 Moon phases
- 📋 Basic weather (clear, cloudy, rain, storm, fog, snow)
- 📋 Fireflies, stars, moonbeams
- 📋 Light source visibility

### Phase 2 - Enhancement
- Seasonal color variations
- Weather particles (rain, snow, fog)
- Sunrise/sunset transition effects
- Biome-specific palettes
- More weather types

### Phase 3 - Polish
- Rare celestial events
- Biological phenomena
- Magical effects
- Sound integration
- Advanced particles

### Phase 4 - Expansion
- Natural disasters
- Climate zone variations
- Full seasonal cycle
- All biome support

---

## Adding New Effects

### Server Side

1. Add key to appropriate module (`Weather`, `Atmosphere`, etc.)
2. Add to `visual_state` payload
3. Update serializer

### Client Side

1. Add condition check in `ParticleLayer`
2. Create particle component
3. Add color adjustments to `DynamicTheme`
4. Test with manual time/weather changes

---

## 10. TAG SYSTEM

Tags are the primary mechanism for triggering visual effects. Room prototypes define tags that the server processes to determine `visual_state` properties.

### How Tags Work

1. **Room Definition**: Tags are defined in room YAML prototypes
2. **Server Processing**: `serializers.ex` reads tags to determine `is_indoor`, `biome`, etc.
3. **Client Rendering**: Mobile client uses `visual_state` to apply appropriate effects

### Tag Categories

#### Location Tags (Mutually Exclusive)

| Tag | Effect | Notes |
|-----|--------|-------|
| `outdoor` | Full weather/sky effects | Default if no location tag |
| `indoor` | No weather, reduced visibility effects | Rooms with existing light |
| `cave` | Treated as indoor, dark | Requires player light |
| `building` | Treated as indoor | Has existing light sources |

#### Biome Tags (Visual Theming)

These tags set the `biome` field in `visual_state` and trigger biome-specific particles:

| Tag | Particles | Color Adjustments |
|-----|-----------|-------------------|
| `forest` | Fireflies at night | Greener tints |
| `mountain` | Eagles, thin air effect | Cooler/grayer |
| `cave` | Dripping water | Darker |
| `village` | None specific | Warm tones |
| `monastery` | Incense particles (future) | Warm amber |
| `market` | None specific | Standard |
| `water` | Fireflies, ripples | Bluer tints |
| `desert` | Heat shimmer (future) | Warmer/tan |
| `swamp` | Fireflies, fog | Green/murky |
| `enchanted` | Magic motes, sparkles | Ethereal glow |
| `bardo` | Spirit wisps | Otherworldly |

#### Gameplay Tags

| Tag | Effect |
|-----|--------|
| `safe_zone` | No combat, peaceful |
| `starting_room` | Player spawn location |
| `dark` | Always requires light source |
| `lit` | Indoor with existing light |
| `liminal` | Transitional/threshold areas |

### Tag Processing Flow

```
Room YAML → Entity Tags → Serializer → visual_state → Mobile Client
                            ↓
                    room_is_indoor?()  → is_indoor
                    get_room_biome()   → biome
```

### Server-Side Tag Processing

Location: `lib/loka_web/channels/game_channel/serializers.ex`

```elixir
# Indoor detection
defp room_is_indoor?(room) do
  tags = Map.get(room, :tags, [])
  "indoor" in tags or "cave" in tags or "building" in tags
end

# Biome extraction
defp get_room_biome(room) do
  tags = Map.get(room, :tags, [])
  biome_tags = [:forest, :mountain, :cave, :village, :monastery,
                :market, :water, :desert, :swamp, :enchanted, :bardo]
  Enum.find(biome_tags, :default, fn biome ->
    Atom.to_string(biome) in tags
  end)
end
```

### Client-Side Tag Effects

Location: `mobile/src/theme.ts`

```typescript
// Biome-specific particles (getActiveParticles function)
if (phase === 'night') {
  // Fireflies in forest/swamp/water biomes
  if (biome === 'forest' || biome === 'swamp' || biome === 'water') {
    particles.push('fireflies');
  }
}
```

### Example Room Configurations

```yaml
# Outdoor forest clearing
key: forest_clearing
tags:
  - outdoor
  - forest
  - safe_zone

# Indoor temple
key: meditation_hall
tags:
  - indoor
  - monastery
  - safe_zone

# Dark cave
key: deep_cave
tags:
  - cave        # is_indoor = true
  - dark        # Always needs light
  - mountain

# Magical grove
key: enchanted_grove
tags:
  - outdoor
  - enchanted   # biome = enchanted
  - forest      # Also has forest characteristics

# Bardo (death) realm
key: bardo_realm
tags:
  - bardo
  - liminal
  - safe_zone
```

### Light Source Tags (Items)

Items can have tags that determine light source type:

| Tag | Light Type | Text Visibility |
|-----|------------|-----------------|
| `candle` | `:candle` | 45% |
| `torch` | `:torch` | 70% |
| `lantern` | `:lantern` | 100% |

### Future Tag Expansions

| Proposed Tag | Effect |
|--------------|--------|
| `underwater` | Blue tint, bubbles, muffled |
| `volcanic` | Red glow, ash particles |
| `frozen` | Blue tint, frost overlay |
| `cursed` | Sickly green, miasma |
| `blessed` | Golden glow, warmth |
| `windy` | Particle direction bias |
| `noisy` | (Audio only - crowd sounds) |
| `silent` | (Audio only - muffled) |

---

## 11. ENHANCEMENT OPPORTUNITIES

### Near-Term Enhancements

| Feature | Complexity | Impact |
|---------|------------|--------|
| **Seasonal color palettes** | Medium | Autumn oranges, winter blues |
| **Weather intensity** | Low | Light rain vs downpour |
| **Biome-specific colors** | Medium | Desert tan, forest green base |
| **More particle types** | Low | Dust, pollen, embers |
| **Aurora borealis** | Medium | Polar night sky effect |

### Medium-Term Enhancements

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Sound integration** | Medium | Ambient audio matching visual state |
| **Day progress indicator** | Low | Sun/moon position indicator |
| **Temperature effects** | Medium | Heat shimmer, breath clouds |
| **Magical weather** | Medium | Mana storms, eldritch clouds |
| **Eclipses** | Low | Rare celestial events |

### Long-Term Enhancements

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Full seasonal cycle** | High | 4 seasons with transitions |
| **Climate zones** | High | Region-specific weather |
| **Natural disasters** | High | Earthquakes, storms |
| **Procedural sky** | Very High | Realistic cloud movement |

### Adding a New Effect

**Server Side:**
1. Add tag to room prototype YAML
2. Update `get_room_biome/1` if new biome
3. Add to `visual_state` if new state type

**Client Side:**
1. Add condition in `getActiveParticles()` (theme.ts)
2. Create particle component in `ParticleLayer.tsx`
3. Add color adjustments if needed

**Example - Adding "volcanic" biome:**

```elixir
# serializers.ex - Add to biome_tags list
biome_tags = [..., :volcanic]
```

```typescript
// theme.ts - Add volcanic particles
if (biome === 'volcanic') {
  particles.push('embers');
  particles.push('ash');
}
```

```typescript
// ParticleLayer.tsx - Create EmberField component
function EmberField({ count = 15 }) {
  // ... particle animation logic
}
```

---

## 12. YAML CONFIGURATION EXAMPLES

### Complete Room Examples

```yaml
# Standard outdoor room
key: village_square
title: "Village Square"
description: "The heart of the village..."
tags:
  - outdoor
  - village
  - safe_zone

# Room with special lighting
key: forge
title: "The Forge"
description: "Heat radiates from the blazing furnace..."
tags:
  - indoor
  - village
  - safe_zone
  - lit        # Has its own light (furnace)

# Atmospheric cave
key: crystal_cavern
title: "Crystal Cavern"
description: "Phosphorescent crystals line the walls..."
tags:
  - cave
  - enchanted  # Magical glow effect
  - lit        # Crystals provide light

# Transition zone
key: cave_entrance
title: "Cave Entrance"
description: "Daylight fades as the passage descends..."
tags:
  - outdoor    # Still gets weather
  - cave       # Cave aesthetic
  - mountain
```

### Item Light Source Examples

```yaml
# Candle
key: tallow_candle
name: "Tallow Candle"
tags:
  - candle
  - light
  - consumable
components:
  equippable:
    slot: light

# Lantern
key: brass_lantern
name: "Brass Lantern"
tags:
  - lantern
  - light
components:
  equippable:
    slot: light
```

---

## 13. DEBUG SCREEN

A dedicated development screen for testing and previewing environmental effects without a server connection.

### Accessing the Debug Screen

Navigate to `/debug-environment` in the mobile app (via Expo Router).

### Features

| Feature | Description |
|---------|-------------|
| **Phase Selection** | Switch between dawn, day, dusk, night |
| **Moon Phases** | All 8 lunar phases with illumination |
| **Weather Controls** | Clear, cloudy, rain, storm, fog, snow |
| **Biome Selection** | All 12 biome types |
| **Light Source Toggle** | None, candle, torch, lantern |
| **Indoor/Outdoor Toggle** | Test location-based effects |
| **Transition Triggers** | Sunrise/sunset animation preview |
| **Auto-Cycle Mode** | Automatically cycle through phases |
| **Quick Presets** | Common environmental scenarios |
| **State Display** | Live view of current visual_state |

### File Locations

| File | Purpose |
|------|---------|
| `mobile/app/debug-environment.tsx` | Debug screen route |
| `mobile/src/components/EnvironmentDebugPanel.tsx` | Control panel component |

### Extending the Debug Panel

The debug panel is designed for extensibility. To add new options:

**1. Adding New Phases/Weather/Biomes:**
Edit the configuration arrays at the top of `EnvironmentDebugPanel.tsx`:

```typescript
// Add new phase
export const PHASES: { key: TimePhase; label: string; icon: string }[] = [
  // ... existing phases
  { key: 'midnight', label: 'Midnight', icon: '🌑' }, // New
];

// Add new weather
export const WEATHER_OPTIONS: { key: Weather; label: string; icon: string }[] = [
  // ... existing weather
  { key: 'sandstorm', label: 'Sandstorm', icon: '🏜️' }, // New
];

// Add new biome
export const BIOME_OPTIONS: { key: Biome; label: string; icon: string }[] = [
  // ... existing biomes
  { key: 'volcanic', label: 'Volcanic', icon: '🌋' }, // New
];
```

**2. Adding New Presets:**
Add to the Quick Presets section:

```typescript
<Pressable
  style={styles.presetButton}
  onPress={() => onStateChange({
    ...visualState,
    phase: 'night',
    weather: 'clear',
    biome: 'volcanic',
    player_light_source: null,
    is_indoor: false,
  })}
>
  <Text style={styles.presetText}>🌋🌙 Volcanic Night</Text>
</Pressable>
```

**3. Adding New Controls:**
Add a new `<Section>` component:

```typescript
<Section title="New Feature">
  <View style={styles.optionRow}>
    {/* Control elements */}
  </View>
</Section>
```

### Sample Room Content

The debug screen displays a sample room with:
- Title: "Test Chamber"
- Description: Atmospheric test text
- 2 NPCs (Test Monk, Wandering Scholar)
- 2 Items (Light Crystal, Weather Vane)
- 4 Exits (north, east available; south, west blocked)
- 1 Other player visible
- Sample event log entries

This allows testing how environmental effects interact with all UI elements.

### Use Cases

| Scenario | How to Test |
|----------|-------------|
| Night visibility | Set phase to night, toggle light sources |
| Weather effects | Change weather, observe particle effects |
| Biome theming | Switch biomes, observe color changes |
| Transitions | Use sunrise/sunset triggers |
| Edge cases | Use auto-cycle to catch glitches |
| New effects | Add to presets, verify appearance |

### Console Logging

All interactions are logged to console for debugging:
- Entity presses: `Entity pressed: {id} ({type})`
- Navigation: `Navigate: {direction}`
- Chat: `Say: {message}` / `Shout: {message}`
- Menu: `Menu opened`
