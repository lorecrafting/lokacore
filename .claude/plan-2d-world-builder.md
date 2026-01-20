# 2D Canvas World Builder Implementation Plan

## Overview

Replace the React Three Fiber 3D viewport with a native Canvas 2D viewport. This eliminates React dependency conflicts with LiveView and simplifies the rendering pipeline.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LiveView (world_builder_live.ex)                            │
│   - Manages room data, selection, validation                │
│   - Sends push_events to JS hook                            │
│   - Receives pushEvent from JS hook                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WorldBuilder2D Hook (app.js)                                │
│   - Receives room data via handleEvent                      │
│   - Manages Canvas2DViewport instance                       │
│   - Handles keyboard shortcuts                              │
│   - Sends selection/interaction events to LiveView          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Canvas2DViewport Class (world_builder/Canvas2DViewport.js)  │
│   - Renders rooms, exits, grid to Canvas                    │
│   - Handles mouse events (pan, zoom, click, drag-select)    │
│   - Manages camera (pan offset + zoom level)                │
│   - Z-level filtering                                       │
└─────────────────────────────────────────────────────────────┘
```

## Changes Required

### 1. Files to Create
- `server/assets/js/world_builder/Canvas2DViewport.js` - Main 2D rendering class

### 2. Files to Modify
- `server/assets/js/app.js` - Replace WorldBuilder hook with 2D version
- `server/lib/loka_web/live/admin_live/world_builder/viewport_container.ex` - Update template for 2D

### 3. Files to Remove (Later cleanup)
- `server/assets/js/world_builder/Viewport.jsx`
- `server/assets/js/world_builder/Exit.jsx`
- `server/assets/js/world_builder/App.jsx`
- `server/assets/js/world_builder/useSelection.js` (keep UndoManager.js)

## Implementation Details

### Canvas2DViewport Class

```javascript
class Canvas2DViewport {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Camera state
    this.camera = { x: 0, y: 0, zoom: 1 };

    // Data
    this.rooms = [];
    this.validation = {};
    this.selectedRoom = null;
    this.selectedKeys = new Set();
    this.currentZLevel = 0;

    // Visual settings
    this.gridSize = 50;  // pixels per unit
    this.roomSize = 40;  // pixels

    // Callbacks
    this.onSelectRoom = options.onSelectRoom;
    this.onBatchSelect = options.onBatchSelect;

    // Setup
    this.setupEventListeners();
    this.startRenderLoop();
  }
}
```

### Room Rendering (2D)

```
┌─────────────────┐
│  Room Name      │  ← Label above
├─────────────────┤
│   👤 👤 📦     │  ← Entity icons inside
│                 │
│      ↑↓        │  ← Up/down indicators
├─────────────────┤
│  room_key       │  ← Key below (smaller)
└─────────────────┘
```

### Color Scheme (Preserved)
- Default room: `#7eb3ff`
- Selected: `#4a9eff` + border glow
- Multi-selected: `#ffaa00` + orange border
- Error: `#ff6b6b` + red glow
- Warning: `#ffd93d` + yellow glow

### Exit Colors (Preserved)
- north: `#4a9eff` (blue)
- south: `#ff4a9e` (pink)
- east: `#4aff9e` (green)
- west: `#ff9e4a` (orange)
- up: `#9e4aff` (purple)
- down: `#ffff4a` (yellow)

### Z-Level Handling

UI at top of viewport:
```
[ Z:-1 ] [ Z:0 ▼ ] [ Z:1 ] [ Z:2 ]
```

- Only rooms at current Z-level are rendered fully
- Rooms on adjacent Z-levels shown as ghosts (20% opacity)
- Up/down indicators show connections to other levels

### Mouse Controls
- **Left click**: Select room
- **Shift + Left click**: Toggle multi-select
- **Left drag on empty**: Pan canvas
- **Left drag from room**: Box select (future)
- **Scroll wheel**: Zoom in/out
- **Right click**: Context menu (future)

### Coordinate System
- Canvas origin at center
- X increases right, Y increases down (standard 2D)
- Room position (x, y) maps to canvas: `(x * gridSize, y * gridSize)`
- Camera offset applied for panning

## Implementation Steps

### Phase 1: Create Canvas2DViewport Class
1. Create new file with class structure
2. Implement room rendering (rectangles with labels)
3. Implement exit rendering (lines with arrows)
4. Implement grid rendering
5. Implement camera pan/zoom

### Phase 2: Update WorldBuilder Hook
1. Replace React rendering with Canvas2DViewport instantiation
2. Keep all existing event handlers
3. Update render() to call viewport.render()
4. Keep keyboard shortcuts and undo manager

### Phase 3: Update Viewport Container
1. Remove React-specific attributes
2. Add Z-level tabs UI
3. Ensure canvas fills container

### Phase 4: Test & Verify
1. Room rendering and colors
2. Exit connections
3. Selection (single and multi)
4. Keyboard shortcuts
5. Pan/zoom
6. Z-level switching

## Preserved Features Checklist

- [ ] Room rendering with names and keys
- [ ] Room color coding (selected, multi, validation)
- [ ] Exit arrows with direction colors
- [ ] Entity icons (NPCs, items)
- [ ] Grid background
- [ ] Pan and zoom
- [ ] Single room selection
- [ ] Multi-room selection (Shift+click)
- [ ] Select all (Ctrl+A)
- [ ] Keyboard shortcuts (Delete, Ctrl+D, etc.)
- [ ] Undo/redo integration
- [ ] Z-level filtering
- [ ] Up/down indicators
- [ ] LiveView event integration

## Risk Mitigation

1. **Gradual Migration**: Keep old React code until 2D is verified working
2. **Same Event Interface**: Use identical pushEvent calls so LiveView doesn't change
3. **Same Data Structure**: Room objects unchanged
4. **Feature Parity First**: Match existing features before adding new ones
