# Decision: Migrate from React Native + Bevy to Godot 4.6

**Date**: 2026-01-26
**Status**: Accepted
**Decision Makers**: Raymond Luong

## Context

Loka needs a mobile 3D client for the "magic book" interface. The initial implementation used:
- **React Native + Expo**: UI shell, authentication, Phoenix channel connection
- **Rust/Bevy**: 3D book rendering with page curl animation
- **uniffi-bindgen-react-native**: Bridge between RN and Rust

This architecture worked but had significant friction:
- 5-30 second compile times for any Rust change
- Complex iOS build pipeline (uniffi + Xcode + CocoaPods)
- Monetization required native SDK integration on both platforms
- No hot reload for 3D content iteration

## Decision

Migrate to **Godot 4.6** as the sole mobile client technology.

## Rationale

### Why Godot over React Native + Bevy

| Factor | React Native + Bevy | Godot 4.6 |
|--------|---------------------|-----------|
| **Iteration speed** | 5-30s compile | Instant hot reload |
| **Mobile export** | uniffi + Xcode complex | One-click export |
| **IAP/Ads** | Native SDKs required | Plugin ecosystem |
| **Build size** | ~30MB | ~25MB |
| **Learning curve** | Rust + RN + uniffi | GDScript only |
| **3D rendering** | Excellent (Bevy) | Good (Mobile renderer) |
| **Text rendering** | Custom (cosmic-text) | Built-in RichTextLabel |

### Why Godot over Unity

From research conducted 2026-01-26 (see conversation history):
- Unity's IAP/Ads are more mature, but Godot + RevenueCat server-side provides equivalent reliability
- Godot's lightweight architecture aligns with our stateless client design
- Zero runtime fees at scale
- Open source = no vendor lock-in risk

### Trade-offs Accepted

1. **Less mature IAP ecosystem** - Mitigated by server-side RevenueCat integration
2. **Smaller community** - Acceptable for our use case
3. **Learning new engine** - GDScript is simpler than Rust

## Implementation

### Archived Code

The React Native + Bevy implementation is preserved in:
```
git checkout archive/react-native-bevy-client
```

Contains:
- `mobile/`: Complete React Native Expo app
- `book-client/`: Rust/Bevy 3D book renderer
- `book-renderer-lib/`: uniffi-bindgen-react-native bridge

### New Structure

```
godot-client/
├── scenes/          # Godot scenes (.tscn)
├── scripts/         # GDScript (.gd)
├── shaders/         # GLSL shaders (.gdshader)
└── project.godot    # Project config
```

### Migration Path

1. **Phase 1** (Current): Basic book page with navigation ✓
2. **Phase 2**: Phoenix WebSocket integration
3. **Phase 3**: Full UI (menus, inventory, dialogue)
4. **Phase 4**: Visual effects (page curl shader, particles)
5. **Phase 5**: Monetization (RevenueCat + AdMob plugins)
6. **Phase 6**: iOS/Android release

## Consequences

### Positive
- Faster development iteration
- Simpler deployment pipeline
- Better maintainability (single codebase)
- Lower barrier for future contributors

### Negative
- Lost investment in Rust/Bevy code (preserved in branch)
- Need to re-implement some features
- Less control over low-level rendering

### Neutral
- Different shader language (GLSL vs WGSL)
- Different scripting paradigm (GDScript vs Rust)

## References

- Godot vs Unity comparison: [conversation 2026-01-26]
- RevenueCat server-side integration: [conversation 2026-01-26]
- Archive branch: `archive/react-native-bevy-client`
