# Visual Polish Guide: From Prototype to AAA Quality

This guide documents best practices for creating polished, professional-quality visual effects in the Loka Book Renderer, inspired by games like World of Warcraft, Diablo, and other AAA titles.

## Core Principles

### 1. Layering is Everything

AAA effects are never a single thing - they're **5-10 layers** working together:

```
Layer Stack (bottom to top):
┌─────────────────────────────────────┐
│  Post-Processing (bloom, vignette)  │  ← Screen-space
├─────────────────────────────────────┤
│  Particles (embers, sparks, dust)   │  ← World-space
├─────────────────────────────────────┤
│  Distortion (heat shimmer, ripples) │  ← Screen-space
├─────────────────────────────────────┤
│  Secondary Effects (smoke, trails)  │  ← World-space
├─────────────────────────────────────┤
│  Primary Effect (fire, ice, glow)   │  ← Material shader
├─────────────────────────────────────┤
│  Base Geometry (page, text)         │  ← Mesh + texture
└─────────────────────────────────────┘
```

### 2. The 80/20 Rule of Polish

80% of visual impact comes from:
- **Bloom/Glow** - Makes things feel luminous and magical
- **Particles** - Adds life and motion
- **Color grading** - Sets mood and cohesion
- **Screen shake** - Adds weight and impact

### 3. Contrast Creates Interest

- Bright effects on dark backgrounds
- Fast motion against slow motion
- Large shapes with small detail particles
- Saturated colors next to desaturated

### 4. Secondary Motion

Everything should have a reaction:
- Fire creates rising embers
- Ice creates falling frost particles
- Magic creates ambient sparkles
- Movement creates trailing effects

---

## Effect-Specific Guidelines

### Fire Effects

**Color Palette:**
```
Core:     #FFFFFF (white-hot center)
Inner:    #FFFF00 → #FFA500 (yellow to orange)
Outer:    #FF4500 → #8B0000 (orange-red to dark red)
Smoke:    #2F2F2F with 50% opacity
Embers:   #FF6600 with additive blending
```

**Layers for Fire:**
1. Base flame shape (procedural noise)
2. Inner glow (brighter, tighter)
3. Outer glow (bloom post-process)
4. Heat distortion (above flames)
5. Ember particles (rising)
6. Smoke particles (trailing)
7. Light emission (dynamic light on surroundings)

**Animation Principles:**
- Flames flicker at 8-15 Hz
- Embers rise at varied speeds (parallax depth)
- Smoke moves slower than fire
- Base of flame is more stable than tips

### Ice Effects

**Color Palette:**
```
Core:     #FFFFFF (frost white)
Primary:  #00FFFF → #0080FF (cyan to blue)
Secondary: #E0FFFF (light cyan highlights)
Frost:    #FFFFFF with 30% opacity overlay
Crystals: #ADD8E6 with specular highlights
```

**Layers for Ice:**
1. Base frozen texture
2. Crystalline overlay (refractive)
3. Frost particles (slowly falling)
4. Ice crack lines (animated)
5. Cold mist (volumetric or particle)
6. Specular highlights (sharp, bright)

### Magic/Arcane Effects

**Color Palette:**
```
Primary:  #9400D3 → #4B0082 (violet to indigo)
Secondary: #FF00FF (magenta accents)
Energy:   #00FFFF (cyan sparks)
Core:     #FFFFFF (bright center)
```

**Layers for Magic:**
1. Energy core (pulsing)
2. Rune patterns (rotating)
3. Energy tendrils (procedural curves)
4. Sparkle particles (random bursts)
5. Glow aura (soft bloom)
6. Ambient wisps (floating)

---

## Technical Implementation

### Post-Processing Stack (Bevy)

```rust
// Recommended post-processing order
app.add_plugins((
    BloomPlugin,           // Glow effects
    ToneMappingPlugin,     // HDR to SDR
    ColorGradingPlugin,    // Mood/atmosphere
    VignettePlugin,        // Edge darkening
    ChromaticAberrationPlugin, // Optional: impact effects
));
```

### Particle System Guidelines

```rust
// Ember particle settings
EmitterConfig {
    spawn_rate: 20.0..40.0,      // Per second
    lifetime: 1.5..3.0,          // Seconds
    initial_velocity: Vec3::Y * 0.5..1.5,
    gravity: Vec3::Y * -0.1,     // Slight downward (embers fight gravity)
    size: 0.02..0.08,
    color_over_lifetime: Gradient::new()
        .add(0.0, Color::rgba(1.0, 0.6, 0.0, 1.0))  // Bright orange
        .add(0.7, Color::rgba(1.0, 0.3, 0.0, 0.5))  // Dim red
        .add(1.0, Color::rgba(0.5, 0.0, 0.0, 0.0)), // Fade out
    blend_mode: BlendMode::Additive,
}
```

### Shader Best Practices

1. **Use HDR colors** - Values > 1.0 for bloom to pick up
2. **Smooth gradients** - Use smoothstep, not linear lerp
3. **Multiple noise octaves** - fBm for natural-looking effects
4. **Time-based variation** - Different speeds for different elements
5. **UV distortion** - For heat shimmer and magical effects

```wgsl
// HDR fire color (bloom-friendly)
fn fire_color_hdr(t: f32) -> vec3<f32> {
    let base = fire_color(t).rgb;
    // Boost bright areas for bloom
    let luminance = dot(base, vec3(0.299, 0.587, 0.114));
    return base * (1.0 + luminance * 2.0);  // HDR boost
}
```

---

## Cohesive Visual Identity

### Establishing a Style Guide

For Loka's "magical book" aesthetic:

**Overall Mood:** Ancient, mystical, warm but mysterious

**Color Temperature:**
- Warm base (parchment, candlelight)
- Cool magic accents (blue, purple)
- High contrast for readability

**Material Language:**
- Parchment: Aged, textured, slightly translucent
- Ink: Deep, rich blacks with subtle sheen
- Magic: Glowing, ethereal, semi-transparent
- Fire: Warm, dynamic, dangerous
- Ice: Cold, sharp, crystalline

**Motion Language:**
- Page turns: Smooth, elegant, weighted
- Text effects: Subtle ambient + dramatic when triggered
- Particles: Gentle drift with occasional bursts
- Transitions: Ease-in-out, never linear

---

## Performance Considerations

### Budget Allocation

For 60fps on mobile:
- Post-processing: 2-3ms
- Particles: 1-2ms (limit to 200 active)
- Shaders: 1-2ms per complex material
- Reserve: 5ms for spikes

### Optimization Techniques

1. **LOD for particles** - Fewer particles when distant/small
2. **Shader complexity toggle** - Simpler effects for low-end
3. **Particle pooling** - Reuse particle objects
4. **Texture atlases** - Single draw call for particles
5. **Compute shaders** - GPU particle simulation

---

## Implementation Phases

### Phase 1: Visual Impact (High ROI)
- [ ] Add bloom post-processing
- [ ] Add heat distortion shader
- [ ] Improve fire color palette (HDR)
- [ ] Add basic ember particles

### Phase 2: Atmosphere
- [ ] Parchment texture (not flat color)
- [ ] Ambient dust particles
- [ ] Page edge glow
- [ ] Subtle vignette

### Phase 3: Polish
- [ ] Screen shake system
- [ ] Sound effect integration
- [ ] Transition animations
- [ ] Loading/idle states

### Phase 4: Advanced
- [ ] Dynamic lighting from effects
- [ ] Volumetric effects (fog, light rays)
- [ ] Procedural animation system
- [ ] Effect composition system

---

## Reference Resources

### Shader Tutorials
- [The Book of Shaders](https://thebookofshaders.com)
- [Shadertoy](https://www.shadertoy.com) - Search: fire, magic, ice
- [Catlike Coding](https://catlikecoding.com/unity/tutorials/) - Concepts transfer

### GDC Talks
- "The Art of Diablo" - Blizzard
- "VFX of God of War" - Santa Monica Studio
- "Stylized VFX in Fortnite" - Epic Games

### Bevy Resources
- [bevy_hanabi](https://github.com/djeedai/bevy_hanabi) - GPU particles
- [bevy_atmosphere](https://github.com/JonahPlusPlus/bevy_atmosphere) - Sky/atmosphere
- Bevy examples: `examples/shader/` and `examples/3d/`

---

## Quality Checklist

Before shipping an effect:

- [ ] Does it have at least 3 layers?
- [ ] Is there secondary motion (particles, trails)?
- [ ] Does it use HDR colors for bloom?
- [ ] Is there smooth easing (not linear)?
- [ ] Does it have a clear silhouette?
- [ ] Is the color palette cohesive?
- [ ] Does it perform well on target hardware?
- [ ] Is there audio feedback?
- [ ] Does it feel "weighty" and impactful?
