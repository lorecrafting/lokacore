# Canvas2D System Architecture

## Overview

The World Builder viewport uses a custom 2D canvas system for rendering rooms, exits, and handling user interactions. The system is split into three main classes following separation of concerns: orchestration, rendering, and interaction.

## File Responsibilities

### Canvas2DViewport.js (Orchestrator)

**Purpose:** Main entry point and public API. Coordinates renderer and interaction handler, manages all state.

**Lifecycle:** Created by WorldBuilder hook (`world_builder.js`), destroyed on unmount via `destroy()`.

**Key Methods:**
- `constructor(canvas, options)` - Initialize with callbacks for selection/movement
- `setRooms(rooms)` - Update room data, auto-detects Z-levels
- `setValidation(validation)` - Update validation results for error display
- `setSelectedRoom(key)` / `setSelectedKeys(keys)` - Selection state
- `setZLevel(level)` - Switch floor/layer
- `setZoneColors(colors)` / `setRoomZoneMap(map)` - Zone visualization
- `setNPCPaths(paths)` - NPC patrol path visualization
- `centerOnRoom(roomKey)` - Camera navigation
- `fitToRooms()` - Auto-fit camera to show all rooms
- `resetCamera()` - Reset to origin
- `worldToScreen(x, y)` / `screenToWorld(x, y)` - Coordinate transforms
- `getRoomAtPoint(screenX, screenY)` - Hit testing
- `scheduleRender()` - Coalesce rapid updates via requestAnimationFrame
- `destroy()` - Cleanup resources

**CSS Integration:** Reads `--wb-viewport-*` variables at construction for theming. Falls back to hardcoded values from `constants.js`.

### Canvas2DRenderer.js (Drawing)

**Purpose:** All canvas draw operations. Receives state via callback, never owns state.

**Key Methods:**
- `render()` - Main render loop, draws all layers in order
- `drawGrid(ctx, state)` - Background grid with origin crosshair
- `drawRoomsAtZLevel(ctx, state, zLevel, opacity)` - Rooms at specific Z level
- `drawRoom(ctx, state, room, opacity)` - Single room with labels/indicators
- `drawExits(ctx, state)` - Exit connections between rooms
- `drawExitArrow(ctx, state, fromRoom, toRoom, direction)` - Single exit line
- `drawNPCPaths(ctx, state)` - Patrol paths as dashed lines
- `drawPathArrows(ctx, state, route, color)` - Direction arrows on paths
- `drawEntityIndicators(ctx, state, room, x, y, halfSize)` - NPC/item icons
- `drawVerticalExitIndicators(ctx, state, room, x, y, halfSize)` - Up/down arrows
- `drawSnapIndicator(ctx, state)` - Grid snap crosshairs during drag
- `truncateText(text, maxWidth, ctx, fontSize)` - Memoized text truncation
- `clearTruncateCache()` - Clear cache on zoom change

**Rendering Loop:** Single `render()` call per frame, scheduled by viewport via `requestAnimationFrame`.

**Layer Order:**
1. Background (fill)
2. Grid (if visible)
3. Ghost rooms (adjacent Z-levels, 20% opacity)
4. NPC patrol paths
5. Exit connections
6. Rooms at current Z-level
7. Snap indicator (during drag)

**Color System:** Uses colors from viewport state (read from CSS vars at construction).

### Canvas2DInteraction.js (Input)

**Purpose:** Mouse and keyboard event handling. Manages drag state, tooltips.

**Key Methods:**
- `attach()` - Register all event listeners and observers
- `detach()` - Remove all listeners and observers
- `handleMouseDown(e)` - Start room drag or camera pan
- `handleMouseMove(e)` - Update drag position, tooltip
- `handleMouseUp(e)` - Finalize drag, fire callbacks
- `handleMouseLeave(e)` - Cancel drag, restore position
- `handleWheel(e)` - Zoom centered on mouse position
- `handleKeyDown(e)` / `handleKeyUp(e)` - Shift key for grid snap
- `showTooltip(room, screenX, screenY)` / `hideTooltip()` - Room info tooltip

**Event Flow:**
1. Event fires on canvas
2. Interaction handler updates internal state (drag, pan, hover)
3. Calls viewport methods to update state or trigger render
4. Fires viewport callbacks (`onSelectRoom`, `onMoveRoom`, `onBatchSelect`)

### constants.js (Fallbacks)

**Purpose:** Hardcoded fallback values when CSS vars unavailable (tests, canvas rendering before DOM ready).

**Exports:**
- `EXIT_COLORS` - Direction colors (north, south, etc.)
- `ROOM_COLORS` - State colors (default, selected, error, etc.)
- `VIEWPORT_COLORS` - Background, grid, borders
- `SPACING`, `FONT_SIZES`, `BORDER_RADIUS`, `Z_INDEX` - UI tokens
- `CANVAS_DEFAULTS` - gridSize, roomSize, zoom limits

**IMPORTANT:** Must stay in sync with `assets/css/variables.css`.

## Data Flow

```
LiveView assigns (rooms, entities, selection, validation)
          |
          v
    WorldBuilder Hook (world_builder.js)
          |
          | setRooms(), setSelectedRoom(), etc.
          v
    Canvas2DViewport (orchestrator)
          |
          |-- scheduleRender() --+
          |                      |
          +-- _getRendererState()
          |         |
          v         v
  Canvas2DInteraction    Canvas2DRenderer
  (event handlers)       (requestAnimationFrame)
          |                      |
          |-- onSelectRoom() --->| (callback to hook)
          |-- onMoveRoom() ----->| (callback to hook)
          |                      |
          v                      v
    Updates viewport         Draws to canvas
    state, triggers
    render
```

## Coordinate Systems

| System | Description |
|--------|-------------|
| **Screen** | Pixel position on canvas (0,0 = top-left) |
| **World** | Logical grid position (integer = grid cell) |

**Transform:** `World * gridSize + camera offset * zoom + canvas center = Screen`

**Methods:** `worldToScreen(x, y)` for drawing, `screenToWorld(x, y)` for hit testing

## Key Patterns

### Adding a New Drawing Element

1. Add draw method to `Canvas2DRenderer.js` (e.g., `drawNewThing(ctx, state)`)
2. Call from `render()` in appropriate layer order
3. Add any new colors to `constants.js` fallbacks AND `variables.css`

### Adding a New Interaction

1. Add handler method to `Canvas2DInteraction.js`
2. Register event listener in `attach()` with proper binding
3. Add cleanup in `detach()`
4. Call viewport methods to update state/trigger render
5. Fire callbacks if action should notify LiveView

### State Updates from LiveView

```javascript
// In world_builder.js hook
this.handleEvent("rooms_updated", ({ rooms }) => {
  this.viewport.setRooms(rooms)  // Viewport schedules render automatically
})
```

### Callbacks to LiveView

```javascript
// In Canvas2DViewport constructor options
const viewport = new Canvas2DViewport(canvas, {
  onSelectRoom: (key) => this.pushEvent("select_room", { key }),
  onMoveRoom: (key, x, y) => this.pushEvent("move_room", { key, x, y })
})
```

## Color Theming

Colors are read from CSS variables at `Canvas2DViewport` construction:

| CSS Variable Pattern | Instance Property | Usage |
|---------------------|-------------------|-------|
| `--wb-viewport-exit-*` | `this.exitColors` | Exit direction colors |
| `--wb-viewport-room-*` | `this.roomColors` | Room state colors |
| `--wb-viewport-*` | `this.viewportColors` | Background, grid, borders |

Renderer accesses colors via `state.exitColors`, `state.roomColors`, `state.viewportColors`.

## Performance Considerations

- **Render coalescing:** `scheduleRender()` batches multiple updates into single frame
- **Text truncation cache:** Memoized `measureText` results, cleared on zoom change
- **Z-level filtering:** Only draws rooms at current level (+ ghost layers at 20% opacity)

## Related Files

- `world_builder.js` - Hook that creates Canvas2DViewport
- `constants.js` - Fallback color/size values (must sync with `variables.css`)
- `variables.css` - CSS custom properties for theming
- `__tests__/Canvas2DViewport.test.js` - Unit tests (mock canvas, ResizeObserver, getComputedStyle)
