# Environmental Effects System

## Overview

The Environmental Effects System provides dynamic visual presentation based on in-game time, weather, seasons, and location. It creates an immersive "living ebook" experience where the visual presentation shifts smoothly throughout the day/night cycle and responds to environmental conditions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (Elixir)                              │
├─────────────────────────────────────────────────────────────────────┤
│  DayNight ──► Calendar ──► Weather ──► Atmosphere                   │
│      │            │            │            │                        │
│      └────────────┴────────────┴────────────┘                        │
│                         │                                            │
│                    visual_state                                      │
│                         │                                            │
│              GameChannel.room_update                                 │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE (React Native)                         │
├─────────────────────────────────────────────────────────────────────┤
│  EnvironmentProvider (Context)                                       │
│          │                                                           │
│          ├──► DynamicTheme (background, text colors)                │
│          │                                                           │
│          ├──► ParticleLayer (fireflies, stars, weather)             │
│          │                                                           │
│          ├──► TransitionEffects (sunrise, sunset animations)        │
│          │                                                           │
│          └──► LightSourceEffect (darkness/visibility)               │
│                                                                      │
│  RoomView ◄── All effects composited                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Time System

### In-Game Day Duration

**Default: 1 real hour = 1 full in-game day (24 hours)**

Configurable via `DayNight` module:
- `@seconds_per_game_day` - Total real seconds for one game day (default: 3600)
- Each in-game hour = 150 real seconds (2.5 minutes)
- Each in-game minute = 2.5 real seconds

### Time Phases

| Phase | In-Game Hours | Real Duration | Light Level |
|-------|---------------|---------------|-------------|
| Night | 19:00 - 5:00 | ~25 min | 0.1 |
| Dawn | 5:00 - 7:00 | ~5 min | 0.5 |
| Day | 7:00 - 17:00 | ~25 min | 1.0 |
| Dusk | 17:00 - 19:00 | ~5 min | 0.5 |

### Moon Phases

Moon phase cycle: 8 in-game days = 8 real hours

| Phase | Days | Visual Effect |
|-------|------|---------------|
| New Moon | 0 | Darkest night, brightest stars |
| Waxing Crescent | 1 | Faint moonlight |
| First Quarter | 2 | Moderate moonlight |
| Waxing Gibbous | 3 | Bright nights |
| Full Moon | 4 | Maximum moonlight, silver glow |
| Waning Gibbous | 5 | Still bright |
| Last Quarter | 6 | Moderate, rises late |
| Waning Crescent | 7 | Faint, pre-dawn |

## Visual State Payload

The server sends `visual_state` with every `room_update`:

```elixir
%{
  visual_state: %{
    # Time information
    phase: :dawn | :day | :dusk | :night,
    hour: 0..23,
    minute: 0..59,
    light_level: 0.0..1.0,

    # Moon information
    moon_phase: :new | :waxing_crescent | :first_quarter | :waxing_gibbous |
                :full | :waning_gibbous | :last_quarter | :waning_crescent,
    moon_illumination: 0.0..1.0,

    # Weather information
    weather: :clear | :cloudy | :rain | :storm | :fog | :snow,

    # Player state
    player_light_source: nil | :candle | :torch | :lantern,

    # Room properties
    is_indoor: boolean(),
    biome: :forest | :mountain | :cave | :village | ...
  }
}
```

## Client Implementation

### 1. Dynamic Theme System

Colors transition smoothly based on time phase:

```typescript
// Phase color palettes
const phaseThemes = {
  day: {
    background: '#F7F3EB',      // Warm cream parchment
    backgroundAlt: '#EDE8DC',   // Slightly darker
    text: '#2C2416',            // Warm near-black
    textMuted: '#6B5D4D',       // Warm gray-brown
    accent: '#D4A574',          // Warm gold sunlight
  },
  dawn: {
    background: '#FEF0E3',      // Soft peach/rose
    backgroundAlt: '#F5E6D8',
    text: '#3D2E24',            // Warm brown
    textMuted: '#7D6B5D',
    accent: '#E8A87C',          // Rose gold sunrise
  },
  dusk: {
    background: '#E8DCD0',      // Warm amber
    backgroundAlt: '#DDD0C2',
    text: '#2C2416',
    textMuted: '#6B5D4D',
    accent: '#C88B6A',          // Copper sunset
  },
  night: {
    background: '#1A1915',      // Near-black
    backgroundAlt: '#232019',
    text: '#C5B8A5',            // Cream/ivory
    textMuted: '#8B7D6B',
    accent: '#4A5568',          // Cool moonlight blue-gray
  },
}
```

### 2. Particle Effects

| Effect | Conditions | Visual |
|--------|------------|--------|
| Fireflies | Night + outdoor + (forest/wetland) | Amber dots, fade in/out, drift |
| Stars | Night + outdoor + clear | White sparkles, gentle twinkle |
| Moonbeams | Night + outdoor + moon > crescent | Silver-blue diagonal gradient |
| Rain | Rain weather | Vertical streaks, splash at bottom |
| Snow | Snow weather | White flakes drifting down |
| Fog | Fog weather | White overlay, low opacity |
| Mist | Dawn + outdoor | Subtle white ground haze |

### 3. Transition Animations

**Dawn Transition (sunrise):**
1. Background shifts: dark → rose → peach → cream
2. Golden rays animate in from right edge
3. Stars/fireflies fade out
4. Text color: cream → warm brown
5. Duration: 60 seconds

**Dusk Transition (sunset):**
1. Background shifts: cream → amber → purple-gray → dark
2. Copper glow from left/bottom edge
3. Stars begin appearing
4. Text color: warm brown → cream
5. Duration: 60 seconds

### 4. Light Source Visibility

At night, text visibility depends on player's light source:

| Light Source | Text Opacity | Effect |
|--------------|--------------|--------|
| None | 15% | Nearly unreadable, blur effect |
| Candle | 45% | Dim, warm flicker |
| Torch | 70% | Moderate, warm glow |
| Lantern | 100% | Full visibility |

Indoor rooms with existing light sources (lit rooms) don't require player light.

## Server Modules

### DayNight (`lib/loka/framework/world/day_night.ex`)

Core time management:
- `get_time/0` - Returns `{hour, minute}`
- `get_phase/0` - Returns current phase atom
- `get_light_level/0` - Returns 0.0-1.0 float
- `get_visual_state/0` - Returns full visual state map

### Calendar (`lib/loka/framework/world/calendar.ex`)

Extended time tracking:
- `get_moon_phase/0` - Returns moon phase atom
- `get_moon_illumination/0` - Returns 0.0-1.0 float
- `get_day_of_year/0` - For seasonal calculations
- `get_season/0` - Returns season atom

### Weather (`lib/loka/framework/world/weather.ex`)

Weather state:
- `current/0` - Returns current weather atom
- `get_effects/0` - Returns weather gameplay effects

### Atmosphere (`lib/loka/framework/world/atmosphere.ex`)

Combines all systems:
- `describe/0` - Narrative description
- `get_visual_state/0` - Complete visual state for client

## Mobile Components

### EnvironmentProvider

Context provider that manages all environmental state:

```typescript
<EnvironmentProvider visualState={roomData.visual_state}>
  <RoomView ... />
</EnvironmentProvider>
```

### DynamicBackground

Animated background that transitions between phase colors:

```typescript
<DynamicBackground phase={phase} weather={weather}>
  {children}
</DynamicBackground>
```

### ParticleLayer

Renders environmental particles based on conditions:

```typescript
<ParticleLayer
  phase={phase}
  weather={weather}
  moonPhase={moonPhase}
  isOutdoor={!isIndoor}
  biome={biome}
/>
```

### TransitionOverlay

Handles sunrise/sunset special effects:

```typescript
<TransitionOverlay
  previousPhase={prevPhase}
  currentPhase={phase}
  onComplete={() => setTransitioning(false)}
/>
```

### TextVisibility

Wraps text with light-source-dependent styling:

```typescript
<TextVisibility lightSource={playerLightSource} phase={phase}>
  <EbookProse>{description}</EbookProse>
</TextVisibility>
```

## Configuration

### Server Configuration

```elixir
# config/config.exs
config :loka, Loka.Framework.World.DayNight,
  seconds_per_game_day: 3600,  # 1 hour = 1 day
  phase_check_interval: 30_000  # Check every 30 seconds

config :loka, Loka.Framework.World.Calendar,
  moon_cycle_days: 8  # 8 in-game days per moon cycle
```

### Client Configuration

```typescript
// config/environment.ts
export const ENVIRONMENT_CONFIG = {
  transitionDuration: 60000,  // 60 seconds for phase transitions
  particleDensity: {
    fireflies: 15,
    stars: 30,
    rain: 50,
    snow: 40,
  },
  moonbeamOpacity: {
    new: 0,
    crescent: 0.05,
    quarter: 0.1,
    gibbous: 0.15,
    full: 0.2,
  },
}
```

## Future Enhancements

See `docs/reference/environmental-effects-reference.md` for complete lists of:
- All biome types and their visual signatures
- All climate zones
- All weather effects
- Seasonal variations
- Celestial events
- Magical/supernatural effects

### Planned Features

1. **Biome-Specific Palettes**: Each biome adjusts base colors
2. **Seasonal Color Shifts**: Autumn oranges, winter blues, spring greens
3. **Rare Events**: Aurora borealis, eclipses, meteor showers
4. **Weather Particles**: Rain, snow, fog, sandstorm
5. **Sound Integration**: Ambient audio matching visual state
6. **Magical Effects**: Mana storms, spirit manifestations

## Testing

```bash
# Test time progression
mix test test/loka/framework/world/day_night_test.exs

# Test visual state generation
mix test test/loka/framework/world/atmosphere_test.exs

# Manual testing - advance time rapidly
iex> Loka.Framework.World.DayNight.set_time(5, 0)  # Jump to dawn
iex> Loka.Framework.World.DayNight.set_time(19, 0) # Jump to dusk
```
