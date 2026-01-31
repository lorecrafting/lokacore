# Rust Book Client - MVP Implementation Plan

**Status:** Ready for Implementation
**Target:** 12-16 weeks to playable MVP
**Scope:** Prove the "diegetic book" concept works on mobile

---

## MVP Definition

### What MVP IS

A mobile client where you can:
1. ✅ See a 3D book with curling pages
2. ✅ Read game text rendered as ink on pages
3. ✅ Tap links on curved surface (interact with game)
4. ✅ See basic visual effects (fire, ice, damage)
5. ✅ Connect to existing Loka server
6. ✅ Play the actual game (navigate, combat, dialogue)

### What MVP is NOT

- ❌ 3D world behind book (Phase 2)
- ❌ Avatar reading book (Phase 2)
- ❌ Combat breakout to 3D (Phase 3)
- ❌ Spirit walk death system (Phase 2)
- ❌ Bookworm companion (Phase 3)
- ❌ Full effects library (Phase 2)
- ❌ Android (iOS first, Android Phase 2)

---

## Success Criteria

MVP is "done" when:

| Criteria | Measurement |
|----------|-------------|
| **Renders** | 3D book visible on iOS device |
| **Text works** | Can read room descriptions, combat log |
| **Interactive** | Can tap entity names to interact |
| **Connected** | Receives real events from Loka server |
| **Playable** | Can complete tutorial quest using book client |
| **Performance** | 60fps on iPhone 12 or newer |
| **Effects** | At least 3 VFX types working (fire, shake, glow) |

---

## Architecture Decisions (Locked for MVP)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engine | **Bevy** | Future 3D extensibility |
| Text | **cosmic-text** | Proven, handles MUD text |
| Platform | **iOS only** | Faster iteration, add Android later |
| Networking | **React Native** | Keep existing Phoenix connection |
| Bridge | **uniffi** | Mozilla's official solution |
| Physics | **None for MVP** | Simple spring math for pages |

---

## Phase Breakdown

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 0: SPIKE (2 weeks)                                            │
│ Prove: Can we render a curled page with text on iOS?                │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 1: TEXT PIPELINE (3-4 weeks)                                  │
│ Build: Full text rendering with scrolling and links                 │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 2: REACT NATIVE BRIDGE (2-3 weeks)                            │
│ Build: Connect Rust renderer to RN app                              │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 3: GAME INTEGRATION (2-3 weeks)                               │
│ Build: Wire up to Loka server, playable game                        │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 4: CORE EFFECTS (2-3 weeks)                                   │
│ Build: Fire, ice, shake, glow - the "wow" factor                    │
├─────────────────────────────────────────────────────────────────────┤
│ PHASE 5: POLISH (2 weeks)                                           │
│ Fix: Performance, edge cases, testing                               │
└─────────────────────────────────────────────────────────────────────┘

Total: 13-17 weeks (~3-4 months)
```

---

## PHASE 0: SPIKE (2 weeks)

### Goal
Prove the core technical concept works before committing to full build.

### Deliverables

- [ ] **P0.1** Bevy app runs on iOS simulator
- [ ] **P0.2** Render a simple quad (page) with texture
- [ ] **P0.3** Vertex shader curls the page
- [ ] **P0.4** Static text ("Hello Loka") appears on page
- [ ] **P0.5** Tap detection returns UV coordinate
- [ ] **P0.6** Runs on physical iPhone at 30+ fps

### Technical Tasks

```
P0.1 - Bevy iOS Setup (3 days)
├── Install Rust iOS toolchain (rustup target add aarch64-apple-ios)
├── Set up Xcode project with Bevy
├── Follow bevy-in-app pattern for CAMetalLayer
├── Get empty Bevy window rendering on simulator
└── Test on physical device

P0.2 - Page Mesh (2 days)
├── Create subdivided quad mesh (32x32 vertices minimum)
├── UV coordinates for texture mapping
├── Basic PBR material (paper-like)
└── Camera positioned to view page

P0.3 - Curl Shader (2 days)
├── Write WGSL vertex shader for page curl
├── Uniform for curl_amount (0.0 = flat, 1.0 = fully curled)
├── Test animation of curl_amount over time
└── Tweak curl math for natural paper feel

P0.4 - Text to Texture (3 days)
├── Add cosmic-text dependency
├── Create FontSystem with bundled font
├── Render "Hello Loka" to RGBA buffer
├── Upload buffer to wgpu texture
├── Apply texture to page material
└── Verify text is readable on curved surface

P0.5 - Tap Detection (2 days)
├── Implement UV lookup texture approach
├── Render page with UV-as-color shader
├── On tap: sample UV lookup texture
├── Return UV coordinate or "not on page"
└── Test: tap returns correct UV for curled page

P0.6 - Physical Device Test (2 days)
├── Build for physical iPhone
├── Profile frame rate
├── Identify any Metal-specific issues
├── Document device requirements
└── DECISION GATE: Continue or pivot?
```

### Success Gate

**Continue to Phase 1 if ALL true:**
- [x] Page renders with curl
- [x] Text is readable at curl
- [x] Tap returns correct UV
- [x] 30+ fps on physical device

**Pivot if ANY true:**
- [ ] Metal issues can't be resolved
- [ ] Text unreadable on curve
- [ ] Performance < 20fps
- [ ] Tap detection fundamentally broken

---

## PHASE 1: TEXT PIPELINE (3-4 weeks)

### Goal
Full text rendering system with MUD-style features.

### Deliverables

- [ ] **P1.1** Multi-line text with word wrap
- [ ] **P1.2** Colored text spans (damage red, healing green, etc.)
- [ ] **P1.3** Clickable links with visual indicator
- [ ] **P1.4** Scrolling text history (last N lines)
- [ ] **P1.5** Link hit detection on curved surface
- [ ] **P1.6** Dirty region texture updates (performance)

### Technical Tasks

```
P1.1 - Text Layout (4 days)
├── Buffer struct with width constraint
├── ShapeBuffer for text shaping
├── Line breaking at texture width
├── Paragraph spacing
└── Test with long room descriptions

P1.2 - Rich Text (3 days)
├── TextSpan struct with style info
├── Color per span
├── Bold/italic support (font variants)
├── Parse server text format into spans
└── Test combat log with colored damage

P1.3 - Links (3 days)
├── LinkRegion struct (text, bounds, action)
├── Track glyph positions during layout
├── Store link regions in list
├── Visual indicator (underline, color)
└── Test: room entities as links

P1.4 - Scrolling (3 days)
├── Text history buffer (circular, last 100 lines)
├── Scroll offset tracking
├── Gesture: swipe to scroll
├── Auto-scroll to bottom on new text
└── Scroll position indicator (optional)

P1.5 - Link Tap (2 days)
├── UV from tap → texture coordinate
├── Texture coordinate → text position
├── Text position → hit test links
├── Return link action or nil
└── Test: tap entity name triggers action

P1.6 - Performance (3 days)
├── Dirty region tracking
├── Tile-based texture updates
├── Only re-render changed regions
├── Profile texture upload time
└── Target: <5ms for text update
```

### Test Cases

```rust
#[test]
fn test_word_wrap() {
    let buffer = TextBuffer::new(512);  // 512px wide
    buffer.push("This is a very long line that should wrap to multiple lines.");
    assert!(buffer.line_count() > 1);
}

#[test]
fn test_link_detection() {
    let buffer = TextBuffer::new(512);
    buffer.push_link("goblin", LinkAction::ClickEntity("goblin_1"));

    let uv = Vec2::new(0.1, 0.5);  // Approximate link position
    let hit = buffer.hit_test(uv);
    assert!(hit.is_some());
}

#[test]
fn test_scroll() {
    let buffer = TextBuffer::new(512);
    for i in 0..100 {
        buffer.push(&format!("Line {}", i));
    }

    buffer.scroll_to_bottom();
    assert!(buffer.visible_range().end == 100);

    buffer.scroll_up(10);
    assert!(buffer.visible_range().end == 90);
}
```

---

## PHASE 2: REACT NATIVE BRIDGE (2-3 weeks)

### Goal
Connect Rust renderer to existing React Native app.

### Deliverables

- [ ] **P2.1** uniffi bindings compile
- [ ] **P2.2** React Native can call Rust functions
- [ ] **P2.3** Rust renders into React Native view
- [ ] **P2.4** Bidirectional event flow
- [ ] **P2.5** iOS build pipeline works

### Technical Tasks

```
P2.1 - uniffi Setup (3 days)
├── Add uniffi to Cargo.toml
├── Define UDL interface file
├── Generate Swift bindings
├── Test: call Rust from Swift
└── Verify memory management

P2.2 - React Native Module (4 days)
├── Create native module in RN project
├── Expose Rust functions via native module
├── TypeScript types for interface
├── Test: RN calls Rust, gets response
└── Handle errors across boundary

P2.3 - Surface Rendering (4 days)
├── Create native view component
├── Pass CAMetalLayer to Rust
├── Rust renders into provided surface
├── Handle view lifecycle (mount/unmount)
└── Test: see book in RN app

P2.4 - Event Flow (3 days)
├── RN → Rust: text updates, effects, scroll
├── Rust → RN: link taps, gesture events
├── Callback mechanism for async events
├── Test: full round-trip event
└── Error handling both directions

P2.5 - Build Pipeline (3 days)
├── Cargo build integrated with Xcode
├── Universal binary (simulator + device)
├── Release build optimization
├── Document build process
└── CI/CD integration (optional)
```

### Interface Definition

```rust
// uniffi interface (simplified)
namespace loka_book_renderer {
    // Initialization
    fn initialize(metal_layer: u64) -> Result<(), BookError>;
    fn shutdown();

    // Text management
    fn push_text(text: String, style: TextStyle);
    fn push_link(text: String, action: String, style: TextStyle);
    fn clear_text();
    fn scroll_to_bottom();
    fn scroll_by(lines: i32);

    // Effects
    fn apply_effect(effect: VfxEffect);
    fn set_weather(weather: WeatherType, intensity: f32);

    // Page control
    fn set_page_curl(amount: f32);
    fn turn_page(direction: PageDirection);

    // Input (returns action if link tapped)
    fn handle_tap(x: f32, y: f32) -> Option<String>;

    // Render loop
    fn render_frame(delta_time: f32);
};

enum TextStyle {
    Normal,
    Combat,
    System,
    Link,
    Emphasis,
};

enum VfxEffect {
    ScreenShake { intensity: f32, duration: f32 },
    TextFire { intensity: f32 },
    TextIce { intensity: f32 },
    TextGlow { color: String, intensity: f32 },
    DamageFlash { color: String },
};

enum WeatherType {
    Clear,
    Rain,
    Snow,
    Fog,
};
```

---

## PHASE 3: GAME INTEGRATION (2-3 weeks)

### Goal
Play actual Loka game through book client.

### Deliverables

- [ ] **P3.1** Receive game_state on connect
- [ ] **P3.2** Render room descriptions
- [ ] **P3.3** Entity/item links work
- [ ] **P3.4** Navigation works
- [ ] **P3.5** Combat displays correctly
- [ ] **P3.6** Complete tutorial quest

### Technical Tasks

```
P3.1 - Connection (2 days)
├── RN Phoenix connection (already exists)
├── Pass game_state to Rust renderer
├── Initial room render
└── Connection status indicator

P3.2 - Room Rendering (3 days)
├── Parse room from game_state
├── Format: title, description, exits, entities, items
├── Entity names as links
├── Exit directions as links
└── Test with various room types

P3.3 - Interactions (3 days)
├── Tap entity → send click_entity to server
├── Tap exit → send navigate to server
├── Handle response events
├── Update text display
└── Test interaction loop

P3.4 - Navigation (2 days)
├── room_update event handling
├── Clear old room, show new
├── Transition animation (page flip?)
├── Test multi-room navigation
└── Handle blocked exits

P3.5 - Combat (4 days)
├── combat_start event → visual indicator
├── Combat log with colored damage
├── combat_update → HP display
├── Attack button (or tap enemy)
├── combat_end → victory/defeat
└── Test full combat flow

P3.6 - Quest Test (2 days)
├── Accept quest from NPC
├── Complete objectives
├── Turn in quest
├── Verify all events render
└── Document any missing features
```

### Event Handlers

```typescript
// React Native side - wire events to Rust
channel.on('game_state', (state: GameState) => {
  // Clear and render initial room
  BookRenderer.clear_text();
  renderRoom(state.room);
  renderInventorySummary(state.inventory);
});

channel.on('room_update', (payload) => {
  // Page turn animation, then new room
  BookRenderer.turn_page('forward');
  setTimeout(() => renderRoom(payload.room), 300);
});

channel.on('event', (payload: GameEvent) => {
  // Render event text with appropriate style
  const style = eventTypeToStyle(payload.type);
  BookRenderer.push_text(payload.text, style);

  // Apply VFX if present
  if (payload.vfx) {
    payload.vfx.forEach(vfx => BookRenderer.apply_effect(vfx));
  }
});

channel.on('combat_start', (payload) => {
  BookRenderer.push_text(`Combat begins with ${payload.enemy.name}!`, 'Combat');
  BookRenderer.apply_effect({ type: 'ScreenShake', intensity: 0.3, duration: 0.5 });
});

function renderRoom(room: Room) {
  BookRenderer.push_text(room.title, 'Emphasis');
  BookRenderer.push_text(room.description, 'Normal');

  if (room.entities.length > 0) {
    BookRenderer.push_text('\nYou see:', 'Normal');
    room.entities.forEach(entity => {
      BookRenderer.push_link(entity.name, `click_entity:${entity.id}`, 'Link');
    });
  }

  BookRenderer.push_text(`\nExits: ${room.exits.map(e => e.direction).join(', ')}`, 'System');
}
```

---

## PHASE 4: CORE EFFECTS (2-3 weeks)

### Goal
Add "wow factor" - the visual effects that make this special.

### Deliverables

- [ ] **P4.1** Screen shake (scalable intensity)
- [ ] **P4.2** Fire effect on text
- [ ] **P4.3** Ice effect on text
- [ ] **P4.4** Text glow/aura
- [ ] **P4.5** Weather overlay (rain)
- [ ] **P4.6** Damage flash

### Technical Tasks

```
P4.1 - Screen Shake (2 days)
├── Camera offset system
├── Shake intensity parameter
├── Decay over duration
├── Frequency variation
└── Test with combat hits

P4.2 - Fire Text (3 days)
├── Fire shader (noise + gradient)
├── Apply to text region
├── Animate with time uniform
├── Intensity parameter
└── Test with fire damage

P4.3 - Ice Text (3 days)
├── Ice shader (voronoi + blue tint)
├── Frost crystal spread
├── Shimmer effect
├── Intensity parameter
└── Test with ice damage

P4.4 - Text Glow (2 days)
├── Blur sampling for glow
├── Color parameter
├── Pulse animation
├── Apply to specific text ranges
└── Test with level up, buffs

P4.5 - Rain Overlay (3 days)
├── Rain particle shader
├── Droplets on page
├── Wet paper darkening
├── Intensity parameter
└── Test with weather state

P4.6 - Damage Flash (2 days)
├── Screen tint overlay
├── Color based on damage type
├── Quick flash + fade
├── Stack multiple hits
└── Test in rapid combat
```

### Shader Implementations (Simplified for MVP)

```wgsl
// Fire effect - MVP version (simpler than full proposal)
@fragment
fn fs_fire_mvp(in: VertexOutput) -> @location(0) vec4<f32> {
    let text = textureSample(text_texture, sampler, in.uv);
    if (text.a < 0.1) { return text; }

    // Simple noise-based fire
    let noise = fract(sin(dot(in.uv + uniforms.time * 0.5, vec2(12.9898, 78.233))) * 43758.5453);
    let fire_intensity = (1.0 - in.uv.y) * uniforms.intensity;

    let fire_color = mix(
        vec4(1.0, 0.8, 0.2, 1.0),  // Yellow
        vec4(1.0, 0.2, 0.0, 1.0),  // Red
        noise
    );

    return mix(text, fire_color, fire_intensity * 0.7);
}

// Ice effect - MVP version
@fragment
fn fs_ice_mvp(in: VertexOutput) -> @location(0) vec4<f32> {
    let text = textureSample(text_texture, sampler, in.uv);

    // Blue tint + shimmer
    let ice_tint = vec4(0.7, 0.85, 1.0, 1.0);
    let shimmer = sin(in.uv.x * 30.0 + uniforms.time * 3.0) * 0.1 + 0.9;

    return mix(text, text * ice_tint * shimmer, uniforms.intensity);
}
```

---

## PHASE 5: POLISH (2 weeks)

### Goal
Production-ready MVP.

### Deliverables

- [ ] **P5.1** Performance optimization
- [ ] **P5.2** Memory profiling
- [ ] **P5.3** Error handling
- [ ] **P5.4** Edge cases
- [ ] **P5.5** Device testing
- [ ] **P5.6** Documentation

### Technical Tasks

```
P5.1 - Performance (3 days)
├── Profile with Instruments
├── Optimize hot paths
├── Reduce texture uploads
├── GPU shader profiling
└── Target: 60fps consistent

P5.2 - Memory (2 days)
├── Check for leaks (Rust + Swift)
├── Texture memory budget
├── Text history limits
├── Background/foreground handling
└── Low memory warnings

P5.3 - Errors (2 days)
├── Graceful degradation
├── Connection loss handling
├── Invalid state recovery
├── User-facing error messages
└── Crash reporting

P5.4 - Edge Cases (3 days)
├── Very long text
├── Rapid events
├── Orientation changes
├── App backgrounding
├── Network interruption
└── Weird Unicode

P5.5 - Device Testing (2 days)
├── iPhone 12 (minimum)
├── iPhone 14/15
├── iPad (if applicable)
├── Different iOS versions
└── Document requirements

P5.6 - Documentation (2 days)
├── Build instructions
├── Architecture overview
├── API reference
├── Known issues
└── Future roadmap
```

---

## Milestones & Checkpoints

| Week | Phase | Checkpoint | Decision |
|------|-------|------------|----------|
| 2 | P0 Complete | Spike successful? | Continue / Pivot |
| 6 | P1 Complete | Text pipeline works? | Continue / Simplify |
| 9 | P2 Complete | Bridge works? | Continue / Debug |
| 12 | P3 Complete | Game playable? | Continue / Cut scope |
| 15 | P4 Complete | Effects working? | Continue / Ship basic |
| 17 | P5 Complete | **MVP SHIP** | Release TestFlight |

---

## Risk Mitigation

| Risk | Mitigation | Fallback |
|------|------------|----------|
| Bevy mobile issues | Use bevy-in-app pattern | Drop to raw wgpu |
| Text perf problems | Dirty region updates | Reduce text history |
| Bridge complexity | Use battle-tested uniffi | Native Swift renderer |
| Effects too slow | Simplify shaders | Ship with fewer effects |
| Timeline slip | Cut Phase 4 scope | Ship with basic effects only |

---

## Out of Scope for MVP (Phase 2+)

Explicitly deferred:

1. **Android** - Add after iOS MVP validated
2. **3D world** - Book in environment
3. **Avatar** - Character reading book
4. **Spirit walk** - UO-style death system
5. **Bookworm** - Companion creature
6. **Full effects** - Only core 6 effects in MVP
7. **Entity spirits** - Dragon coiling around book
8. **Seasonal themes** - Page appearance changes
9. **Living illustrations** - Animated marginalia

---

## Resource Requirements

### Development

| Resource | Requirement |
|----------|-------------|
| Developer | 1 full-time (Rust + iOS experience helpful) |
| Device | iPhone 12+ for testing |
| Mac | M1+ recommended for iOS builds |
| Accounts | Apple Developer ($99/year) |

### Tools

- Xcode 15+
- Rust 1.75+
- VS Code + rust-analyzer
- Instruments (profiling)

### Dependencies

```toml
[dependencies]
bevy = "0.15"
cosmic-text = "0.12"
uniffi = "0.28"
glam = "0.29"
```

---

## Definition of Done

MVP is **shippable** when:

- [ ] App installs via TestFlight
- [ ] Can login with existing Loka account
- [ ] Book renders with curled pages
- [ ] Text is readable and scrollable
- [ ] Can tap entities/exits to interact
- [ ] Combat works with visual feedback
- [ ] At least 3 effects working (fire, ice, shake)
- [ ] 60fps on iPhone 12
- [ ] No crash in 30-minute play session
- [ ] Tutorial quest completable

---

## Development Workflow

### Daily Development Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│  TERMINAL 1: Loka Server                                            │
│  $ cd server && mix phx.server                                      │
│  Running at localhost:4000                                          │
├─────────────────────────────────────────────────────────────────────┤
│  TERMINAL 2: Rust Development (Fast Iteration)                      │
│  $ cd book-client && cargo watch -x "build --lib"                   │
│  Rebuilds on file change (~5-10 sec)                                │
├─────────────────────────────────────────────────────────────────────┤
│  TERMINAL 3: iOS Simulator (when needed)                            │
│  $ cd book-client/ios && xcodebuild ... | xcpretty                  │
│  Or use Xcode directly for debugging                                │
├─────────────────────────────────────────────────────────────────────┤
│  TERMINAL 4: React Native Metro (integration testing)               │
│  $ cd mobile && npx expo start --ios                                │
│  Hot reload for JS, manual rebuild for Rust changes                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase 0-1 Workflow (Rust-Only Development)

During spike and text pipeline, work in **isolation** from React Native:

```bash
# 1. Create standalone Bevy test app (not a library yet)
cd book-client
cargo new --bin test-app

# 2. Develop with hot-reload equivalent
cargo install cargo-watch
cargo watch -x run   # Rebuilds and runs on save

# 3. Test on iOS simulator directly (no RN)
cargo build --target aarch64-apple-ios-sim
# Run via Xcode or ios-deploy

# 4. Use mock data for text
const MOCK_ROOM: &str = r#"
The Temple Courtyard

Morning light filters through ancient trees. A meditation
circle sits at the center, surrounded by worn stone benches.

You see: [Elder Monk], [Training Dummy]
Exits: north, east, south
"#;
```

**Advantages:**
- Fast iteration (no RN rebuild)
- Pure Rust debugging
- Easy to test edge cases
- Visual verification immediate

### Phase 2+ Workflow (RN Integration)

Once bridging to React Native:

```bash
# 1. Build Rust as library
cd book-client
cargo build --release --target aarch64-apple-ios
cargo build --release --target aarch64-apple-ios-sim

# 2. Generate uniffi bindings
cargo run --bin uniffi-bindgen generate \
  --library target/release/libloka_book.dylib \
  --language swift \
  --out-dir ios/Generated

# 3. Copy to RN project (or use symlink)
cp -r ios/Generated/* ../mobile/ios/LokaBook/

# 4. Rebuild RN native modules
cd ../mobile
npx pod-install  # Installs new native code
npx expo run:ios  # Full rebuild with Rust

# 5. Hot reload JS changes (Rust requires rebuild)
# - JS changes: instant
# - Rust changes: ~30-60 sec rebuild cycle
```

### Recommended IDE Setup

```
┌─────────────────────────────────────────────────────────────────────┐
│  VS Code (Primary - Rust Development)                               │
│  ├── rust-analyzer extension                                        │
│  ├── WGSL extension (shader syntax)                                 │
│  ├── Even Better TOML                                               │
│  └── CodeLLDB (Rust debugging)                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Xcode (Secondary - iOS Debugging)                                  │
│  ├── Metal shader debugging                                         │
│  ├── Instruments profiling                                          │
│  ├── Simulator management                                           │
│  └── Archive for TestFlight                                         │
├─────────────────────────────────────────────────────────────────────┤
│  Claude Code (AI Assistance)                                        │
│  ├── Shader code generation                                         │
│  ├── uniffi binding help                                            │
│  ├── Bevy ECS patterns                                              │
│  └── Debug assistance                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Testing Strategy

```bash
# Unit tests (Rust)
cd book-client
cargo test                    # All tests
cargo test text::             # Text module only
cargo test --release          # Optimized (closer to prod)

# Visual tests (Manual)
cargo run --example book_demo  # Standalone visual test
# Check: Does the page curl look right?
# Check: Is text readable?
# Check: Do effects look good?

# Integration tests (With RN)
cd mobile
npm test                      # Jest tests (JS side)
npx detox test                # E2E (future)

# Performance tests
# In Xcode: Product > Profile > Time Profiler
# Check: Frame rate consistent?
# Check: Memory stable?

# Server integration (Full stack)
# 1. Start server: mix phx.server
# 2. Start RN: npx expo start --ios
# 3. Login and play
# 4. Monitor server logs for events
```

### Build Configurations

```toml
# book-client/Cargo.toml

[profile.dev]
opt-level = 1           # Some optimization for playable dev builds
debug = true

[profile.release]
opt-level = 3
lto = "thin"            # Link-time optimization
strip = true            # Smaller binary

[profile.dev.package."*"]
opt-level = 3           # Optimize dependencies even in dev
```

### Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/phase-0-spike

# Frequent commits
git add -A && git commit -m "P0.2: Basic page mesh rendering"

# Before merge: ensure all tests pass
cargo test
cargo clippy            # Lint
cargo fmt               # Format

# PR with screenshots/recordings of visual changes
# Include before/after for shader changes
```

### Debugging Tips

```rust
// 1. Bevy inspector (visual debugging)
// Add to Cargo.toml for dev:
// bevy-inspector-egui = "0.25"

// 2. Shader debugging - output debug colors
@fragment
fn fs_debug(in: VertexOutput) -> @location(0) vec4<f32> {
    // Output UV as color to verify coordinates
    return vec4(in.uv.x, in.uv.y, 0.0, 1.0);
}

// 3. Rust logging
use log::{debug, info, warn, error};
info!("Text buffer size: {} lines", buffer.line_count());

// 4. Performance timing
let start = std::time::Instant::now();
// ... operation ...
debug!("Texture upload took: {:?}", start.elapsed());
```

### Environment Setup (One-Time)

```bash
# 1. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-ios
rustup target add aarch64-apple-ios-sim
rustup target add x86_64-apple-ios  # Intel simulator

# 2. iOS development
xcode-select --install
# Install Xcode from App Store

# 3. Cargo tools
cargo install cargo-watch    # Auto-rebuild
cargo install cargo-expand   # Macro debugging
cargo install uniffi-bindgen # FFI generation

# 4. Verify setup
rustc --version              # Should be 1.75+
xcrun --sdk iphoneos --show-sdk-path  # Should show iOS SDK

# 5. Clone and setup
cd lokacore
mkdir book-client
cd book-client
cargo init --lib
```

### Typical Day Schedule

```
Morning (Focus Work)
├── 9:00  - Pull latest, review overnight thoughts
├── 9:15  - Deep work: core feature development
├── 12:00 - Lunch break

Afternoon (Integration & Testing)
├── 13:00 - Integration testing with server
├── 14:30 - Bug fixes from morning work
├── 15:30 - Visual polish / shader tweaks
├── 16:30 - Document progress, plan tomorrow
├── 17:00 - Commit & push
```

## Next Steps

1. **Approve this plan** - Review scope, timeline, risks
2. **Set up repository** - Create `book-client/` folder in lokacore
3. **Phase 0 kickoff** - Start spike immediately
4. **Weekly check-ins** - Progress against milestones
5. **Decision gate at Week 2** - Continue or pivot

---

## Appendix: File Structure (Proposed)

```
lokacore/
├── server/                    # Existing Elixir server
├── mobile/                    # Existing React Native app
└── book-client/               # NEW: Rust book renderer
    ├── Cargo.toml
    ├── src/
    │   ├── lib.rs             # uniffi exports
    │   ├── book/
    │   │   ├── mod.rs
    │   │   ├── mesh.rs        # Page mesh generation
    │   │   ├── curl.rs        # Curl animation
    │   │   └── material.rs    # Paper material
    │   ├── text/
    │   │   ├── mod.rs
    │   │   ├── layout.rs      # cosmic-text integration
    │   │   ├── texture.rs     # Text-to-texture
    │   │   └── links.rs       # Link tracking
    │   ├── effects/
    │   │   ├── mod.rs
    │   │   ├── fire.rs
    │   │   ├── ice.rs
    │   │   ├── shake.rs
    │   │   └── weather.rs
    │   └── input/
    │       ├── mod.rs
    │       └── uv_lookup.rs   # Tap detection
    ├── shaders/
    │   ├── page_curl.wgsl
    │   ├── text.wgsl
    │   ├── fire.wgsl
    │   └── ice.wgsl
    ├── assets/
    │   └── fonts/
    │       └── CrimsonText.ttf
    └── ios/
        ├── LokaBook.xcodeproj
        └── LokaBook/
            ├── BookView.swift     # Native view wrapper
            └── RustBridge.swift   # uniffi bindings
```
