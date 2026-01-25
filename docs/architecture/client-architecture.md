# Client Architecture: React Native + Rust/Bevy Hybrid

## Overview

Loka uses a **hybrid client architecture** combining React Native and Rust/Bevy to leverage the strengths of each technology:

- **React Native (Expo 54)**: Social features, chat, UI-heavy interactions
- **Rust/Bevy (0.15)**: Immersive 3D experiences, effects, cinematic moments

Both clients connect to the same Phoenix Channel backend via WebSocket.

## Technology Selection Matrix

| Feature Category | Technology | Reasoning |
|------------------|------------|-----------|
| **Social/Chat** | React Native | - Rich ecosystem (gifted-chat, mentions, etc.)<br>- Native text input, keyboard, notifications<br>- Hot reload (~100ms) for fast iteration<br>- Solved UX patterns |
| **UI Lists** | React Native | - Inventory, quest logs, character sheets<br>- Native scrolling and gestures<br>- Easy forms and inputs |
| **Immersive Reading** | Rust/Bevy | - 3D magical book page-turning<br>- Shader effects (fire, ice, glowing text)<br>- Unique visual identity |
| **Combat Effects** | Rust/Bevy | - Particle systems, spell effects<br>- Screen shake, camera effects<br>- 60fps smooth animations |
| **Cinematic Moments** | Rust/Bevy | - Dragon fly-bys, boss introductions<br>- Environmental storytelling<br>- "Wow" moments that differentiate us |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Device                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────┐                              │
│  │ React Native (Primary)   │                              │
│  │ - Chat & DMs             │                              │
│  │ - Friend lists           │                              │
│  │ - Inventory UI           │                              │
│  │ - Quest logs             │                              │
│  │ - Character sheet        │                              │
│  │ - Settings               │                              │
│  └──────────────────────────┘                              │
│              ↕                                              │
│      (Context switch via deeplink/intent)                   │
│              ↕                                              │
│  ┌──────────────────────────┐                              │
│  │ Rust/Bevy Book Client    │                              │
│  │ - 3D book page turns     │                              │
│  │ - Quest reading          │                              │
│  │ - Combat effects         │                              │
│  │ - Spell animations       │                              │
│  │ - Dragon fly-bys         │                              │
│  │ - Screen shake           │                              │
│  │ - Cinematic moments      │                              │
│  └──────────────────────────┘                              │
│              ↕                    ↕                         │
└──────────────┼────────────────────┼─────────────────────────┘
               │                    │
               └────────────────────┘
                        ↓
         ┌──────────────────────────────┐
         │   Phoenix Server (Elixir)    │
         │   - Phoenix Channels (WS)    │
         │   - Game logic               │
         │   - Entity system            │
         │   - Quest/dialogue           │
         └──────────────────────────────┘
```

## User Flow Examples

### Example 1: Social Coordination
1. Player opens app → **React Native** chat hub
2. Guild discusses strategy in chat → **React Native**
3. Friend sends party invite → **React Native** notification
4. Player accepts, sees party members → **React Native** list

### Example 2: Quest with Cinematic
1. Player accepts quest in **React Native** quest log
2. Taps "Read Quest Introduction" → Launches **Bevy book**
3. **Bevy** shows magical book opening, page turns with quest text
4. Dramatic dragon fly-by animation → **Bevy 3D**
5. Player finishes reading → Returns to **React Native**
6. Combat notifications appear in **React Native** chat

### Example 3: Combat
1. Player enters combat → **React Native** shows combat log/actions
2. Player casts fireball → **React Native** sends command
3. Fireball particle effect plays → **Bevy overlay** (optional)
4. Screen shake on impact → **Bevy effect**
5. Combat result → **React Native** chat notification

## Integration Points

### Phoenix Channels (Shared Backend)
Both clients connect to the same WebSocket API:

```elixir
# Client connects
socket.connect("wss://loka.fly.dev/socket", {token: jwt})
channel = socket.channel("game:lobby")

# Same messages work for both clients
channel.push("action", {type: "cast_spell", target: "dragon"})
channel.on("effect", payload => {
  // React Native: Show chat message
  // Bevy: Play particle effect
})
```

### Context Switching
- **React Native → Bevy**: Deeplink with quest ID
- **Bevy → React Native**: Back navigation or explicit "Open Chat" button
- **Parallel**: Bevy overlay on top of React Native (future)

### State Management
- **Server is source of truth**: Both clients receive same events
- **React Native**: Keeps full game state (inventory, stats, etc.)
- **Bevy**: Lightweight, renders current scene only (book page, effect)

## Bevy 3D Capabilities (What We Can Do)

Since React Native handles UI/chat, Bevy is freed to do what game engines excel at:

### ✅ Visual Effects
- **Screen shake**: Camera transform on impact
- **Particle systems**: Fire, ice, magic, blood
- **Post-processing**: Bloom, motion blur, color grading
- **Lighting effects**: Dynamic shadows, glowing objects
- **Weather**: Rain, snow, fog with 3D particles

### ✅ 3D Animations
- **Flying dragons**: Full skeletal animation, pathfinding
- **Character models**: Animated NPCs, attack animations
- **Environmental**: Torches flickering, water flowing
- **Camera**: Cinematic cuts, tracking shots, zoom effects

### ✅ Advanced Rendering
- **Custom shaders**: Fire text, glowing runes, magical effects
- **PBR materials**: Realistic metal, wood, cloth
- **Mesh deformation**: Page curl (already implemented)
- **Sprite batching**: 2D effects mixed with 3D

### ✅ Physics & Interaction
- **Raycasting**: Touch detection on 3D objects
- **Collisions**: If needed for mini-games
- **Ragdoll**: Death animations
- **Cloth simulation**: Capes, banners

### Example: Dragon Encounter

```rust
// Bevy system for dragon fly-by
fn dragon_encounter(
    mut commands: Commands,
    mut camera: Query<&mut Transform, With<Camera>>,
    time: Res<Time>,
) {
    // Spawn dragon with skeletal animation
    commands.spawn((
        DragonBundle::new("elder_dragon"),
        Animator::play("fly_by"),
        FlightPath::bezier_curve(start, peak, end),
    ));

    // Screen shake on roar
    if dragon.roaring {
        camera.single_mut().translation +=
            random_offset(0.2) * shake_intensity;
    }

    // Particle effects
    commands.spawn(ParticleSystem::fire_breath(dragon.mouth_position));

    // Post-process bloom on dragon fire
    camera.post_process.bloom_intensity = 1.5;
}
```

## Development Workflow

| Client | Iteration Speed | Use For |
|--------|----------------|---------|
| React Native | ~100ms hot reload | Daily feature work (chat, UI) |
| Rust/Bevy | ~5-30s compile | Polish moments (effects, cinematics) |

**Recommendation**: Build core gameplay in React Native first, add Bevy "wow moments" as polish.

## Performance Considerations

### Mobile Performance
- **React Native**: Handles 60fps scrolling, text input
- **Bevy**: Can hit 60fps on modern phones (iPhone 12+, flagship Android)
- **Battery**: Bevy 3D drains more battery - use sparingly for key moments

### App Size
- React Native base: ~40MB
- Bevy client: ~20-30MB (Rust binary + assets)
- Total: ~70MB (acceptable for modern apps)

## Migration Path

Since you already have both in your stack:

### Phase 1: React Native MVP (Current)
- Build core social features in React Native
- Chat, inventory, quest logs, character sheet
- Connect to Phoenix Channels

### Phase 2: Bevy Polish (Future)
- Identify "wow moments" (boss fights, quest intros, spell effects)
- Build Bevy scenes for those moments
- Integrate via deeplink/overlay

### Phase 3: Hybrid Integration
- Smooth transitions between clients
- Optional: Bevy overlay on React Native (advanced)
- Performance optimization

## Why This Works

1. **Leverage strengths**: Each tech does what it's best at
2. **Fail fast**: React Native for iteration, Bevy for polish
3. **Unique identity**: 3D effects differentiate from text MUDs
4. **Practical**: Don't fight Bevy for chat UI, don't limit effects to 2D

## Technical Precedents

- **Genshin Impact**: Unity 3D + native UI overlays
- **Path of Exile Mobile**: Cocos2d-x 3D + native chat
- **Albion Online**: Custom 3D engine + Unity UI

This hybrid approach is industry-standard for social games with 3D elements.

## Conclusion

**Use React Native for:**
- Chat, social, lists, forms
- Anything with text input or complex scrolling
- Daily gameplay interactions

**Use Rust/Bevy for:**
- Screen shake, particle effects, 3D animations
- Flying dragons, cinematic moments
- The magical book experience
- Anything that needs 60fps smooth visuals

**Result**: Fast iteration + unique visual identity + happy developers.
