# LiveView Local Interaction Pattern

## Trigger
Use when implementing continuous user interactions in LiveView: drag, resize, scroll, slider, color picker, or any interaction that fires events at 60fps. Also applies when `render/1` contains inline function calls that recompute on every re-render.

## Problem
LiveView hooks that `pushEvent` on every mousemove/input create a server roundtrip per frame:

```
mousemove → pushEvent (WebSocket) → handle_event → assign → render → diff → DOM patch
Total: 20-70ms per frame (need <16ms for 60fps)
```

This causes visible lag during drag/resize interactions.

## Solution: Local CSS During Interaction, Sync on Completion

### JS Hook Pattern

```javascript
// 1. Compute locally, apply via requestAnimationFrame
handleMouseMove(e) {
  if (!this.isDragging) return
  const newSize = this.computeSize(e)  // Pure math, no server

  if (this.rafId) cancelAnimationFrame(this.rafId)
  this.rafId = requestAnimationFrame(() => {
    // Apply directly to DOM - no server roundtrip
    this.el.style.setProperty('--my-property', `${newSize}px`)
  })
},

// 2. Sync to server ONCE on completion
handleMouseUp() {
  if (this.rafId) cancelAnimationFrame(this.rafId)
  const finalValue = this.getRenderedValue()
  this.pushEvent('update_size', { size: finalValue })  // Single event
}
```

### Key Rules

1. **Never `pushEvent` in mousemove/input handlers** - compute and apply locally
2. **Use `requestAnimationFrame`** to coalesce multiple events per frame (not `setTimeout(16)`)
3. **Sync final state on mouseup/blur** - single `pushEvent` at interaction end
4. **Use CSS custom properties** (`style.setProperty`) for local updates that drive layout
5. **Snapshot state at interaction start** - capture sizes/positions in `mousedown`, compute deltas from there

### CSS Custom Property Update Pattern

For CSS Grid resize, update the custom property directly:

```javascript
applyLocalSize(panel, size) {
  const style = getComputedStyle(this.el)
  const cols = style.getPropertyValue('--grid-columns').trim().split(/\s+/)
  cols[COLUMN_INDEX[panel]] = `${size}px`
  this.el.style.setProperty('--grid-columns', cols.join(' '))
}
```

## Anti-Pattern: Inline Computation in render/1

Functions called inline in LiveView `render/1` recompute on EVERY re-render, even when inputs haven't changed:

```elixir
# BAD - recomputes on every assign change (resize, console message, anything)
<.component entities={build_entity_list(@rooms, @npcs, @items)} />

# GOOD - cached assign, updated only when data changes
<.component entities={@entity_list} />
```

Cache computed values in assigns and update them with a helper:

```elixir
defp update_entity_list(socket) do
  assign(socket, :entity_list,
    build_entity_list(socket.assigns.rooms, socket.assigns.npcs, socket.assigns.items)
  )
end
```

Pipe `update_entity_list/1` into every handler that modifies the source data.

## Anti-Pattern: Multiple Events on Mount

```javascript
// BAD - 5 separate pushEvents, 5 server re-renders
Object.entries(sizes).forEach(([panel, size]) => {
  this.pushEvent('resize_panel', { panel, size })
})

// GOOD - 1 batched pushEvent, 1 server re-render
this.pushEvent('restore_panel_sizes', { sizes })
```

## Performance Budget

| Metric | Target | Red Flag |
|--------|--------|----------|
| Interaction latency | <1ms (local) | >16ms (server roundtrip) |
| Server events during drag | 0 | >0 |
| Server events on mouseup | 1 | >1 |
| requestAnimationFrame | Yes | setTimeout/setInterval |

## Files Reference

- Panel resize implementation: `assets/js/hooks/panel_resize.js`
- Server handler: `world_builder_live.ex` (`handle_event("resize_panel", ...)`)
- Grid layout: `panel_sizes_style/2` in `world_builder_live.ex`
