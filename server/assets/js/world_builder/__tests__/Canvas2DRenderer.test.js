import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Canvas2DRenderer } from '../Canvas2DRenderer.js'

// Create a mock canvas 2D context with all necessary methods
function createMockContext() {
  return {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    font: '',
  }
}

// Create a mock renderer state object
function createMockState(overrides = {}) {
  return {
    camera: { x: 0, y: 0, zoom: 1 },
    rooms: [],
    roomsByKey: new Map(),
    selectedRoom: null,
    selectedKeys: new Set(),
    validation: {},
    zoneColors: {},
    roomZoneMap: {},
    showZoneColors: false,
    npcPaths: {},
    showNPCPaths: false,
    snapIndicator: null,
    isDraggingRoom: false,
    showGrid: true,
    showGhostLayers: false,
    currentZLevel: 0,
    gridSize: 60,
    roomSize: 48,
    width: 800,
    height: 600,
    minZoom: 0.2,
    maxZoom: 3,
    exitColors: {
      north: '#4a9eff',
      south: '#ff4a9e',
      east: '#9eff4a',
      west: '#ff9e4a',
      up: '#4aff9e',
      down: '#9e4aff',
    },
    roomColors: {
      default: '#7eb3ff',
      selected: '#4a9eff',
      multiSelected: '#5ab3ff',
      error: '#ff6b6b',
      warning: '#ffd93d',
    },
    viewportColors: {
      bg: '#1a1a2e',
      grid: '#333344',
      gridMajor: '#555566',
      roomBorder: '#4a4a5e',
      roomBorderMulti: '#6a9eff',
      roomBorderError: '#ff6b6b',
      roomBorderWarning: '#ffd93d',
      roomText: '#ffffff',
      roomKeyText: '#aaaaaa',
      snap: '#4a9eff',
      snapDim: '#2a6eff',
    },
    screenToWorld: vi.fn((sx, sy) => ({
      x: (sx - 400) / 60,
      y: (sy - 300) / 60,
    })),
    worldToScreen: vi.fn((wx, wy) => ({
      x: wx * 60 + 400,
      y: wy * 60 + 300,
    })),
    ...overrides,
  }
}

// Sample room data for testing
function sampleRooms() {
  return [
    {
      key: 'town_square',
      name: 'Town Square',
      x: 0,
      y: 0,
      z: 0,
      exits: { north: 'market', east: 'tavern' },
      spawns: {},
    },
    {
      key: 'market',
      name: 'Market',
      x: 0,
      y: -1,
      z: 0,
      exits: { south: 'town_square' },
      spawns: { npcs: ['merchant'] },
    },
    {
      key: 'tavern',
      name: 'Tavern',
      x: 1,
      y: 0,
      z: 0,
      exits: { west: 'town_square', down: 'cellar' },
      spawns: { items: ['ale', 'bread'] },
    },
    {
      key: 'cellar',
      name: 'Cellar',
      x: 1,
      y: 0,
      z: -1,
      exits: { up: 'tavern' },
      spawns: {},
    },
    {
      key: 'tower_top',
      name: 'Tower Top',
      x: 0,
      y: -1,
      z: 1,
      exits: { down: 'market' },
      spawns: {},
    },
  ]
}

// Create state with rooms and roomsByKey populated
function createStateWithRooms(overrides = {}) {
  const rooms = sampleRooms()
  const roomsByKey = new Map(rooms.map((r) => [r.key, r]))
  return createMockState({
    rooms,
    roomsByKey,
    ...overrides,
  })
}

describe('Canvas2DRenderer', () => {
  let renderer
  let mockCtx
  let mockGetState
  let mockState

  beforeEach(() => {
    mockCtx = createMockContext()
    mockState = createMockState()
    mockGetState = vi.fn(() => mockState)
    renderer = new Canvas2DRenderer(mockCtx, mockGetState)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor', () => {
    it('stores canvas context reference', () => {
      expect(renderer.ctx).toBe(mockCtx)
    })

    it('stores getState callback', () => {
      expect(renderer.getState).toBe(mockGetState)
    })

    it('initializes empty truncation cache', () => {
      expect(renderer._truncateCache).toBeInstanceOf(Map)
      expect(renderer._truncateCache.size).toBe(0)
    })
  })

  // ============================================================================
  // Truncation Cache
  // ============================================================================

  describe('truncation cache', () => {
    it('clearTruncateCache() clears the cache', () => {
      renderer._truncateCache.set('test', 'value')
      renderer._truncateCache.set('test2', 'value2')
      expect(renderer._truncateCache.size).toBe(2)

      renderer.clearTruncateCache()

      expect(renderer._truncateCache.size).toBe(0)
    })

    it('truncateCacheSize returns cache size', () => {
      expect(renderer.truncateCacheSize).toBe(0)

      renderer._truncateCache.set('test', 'value')
      expect(renderer.truncateCacheSize).toBe(1)

      renderer._truncateCache.set('test2', 'value2')
      expect(renderer.truncateCacheSize).toBe(2)
    })
  })

  // ============================================================================
  // Main Render
  // ============================================================================

  describe('render()', () => {
    it('clears canvas with background color', () => {
      renderer.render()

      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600)
    })

    it('saves and restores context for camera transform', () => {
      renderer.render()

      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('applies camera translation to center of canvas', () => {
      renderer.render()

      // First translate to center (width/2, height/2)
      expect(mockCtx.translate).toHaveBeenCalledWith(400, 300)
    })

    it('applies camera zoom via scale', () => {
      mockState.camera.zoom = 1.5
      renderer.render()

      expect(mockCtx.scale).toHaveBeenCalledWith(1.5, 1.5)
    })

    it('applies camera pan offset via second translate', () => {
      mockState.camera.x = 100
      mockState.camera.y = -50
      renderer.render()

      // Second translate with camera offset
      expect(mockCtx.translate).toHaveBeenCalledWith(100, -50)
    })

    it('draws grid when showGrid is true', () => {
      mockState.showGrid = true
      const drawGridSpy = vi.spyOn(renderer, 'drawGrid')

      renderer.render()

      expect(drawGridSpy).toHaveBeenCalledWith(mockCtx, mockState)
    })

    it('does not draw grid when showGrid is false', () => {
      mockState.showGrid = false
      const drawGridSpy = vi.spyOn(renderer, 'drawGrid')

      renderer.render()

      expect(drawGridSpy).not.toHaveBeenCalled()
    })

    it('draws ghost layers when showGhostLayers is true', () => {
      mockState.showGhostLayers = true
      mockState.currentZLevel = 0
      const drawRoomsAtZLevelSpy = vi.spyOn(renderer, 'drawRoomsAtZLevel')

      renderer.render()

      // Should draw z-1 and z+1 with opacity 0.2
      expect(drawRoomsAtZLevelSpy).toHaveBeenCalledWith(mockCtx, mockState, -1, 0.2)
      expect(drawRoomsAtZLevelSpy).toHaveBeenCalledWith(mockCtx, mockState, 1, 0.2)
    })

    it('does not draw ghost layers when showGhostLayers is false', () => {
      mockState.showGhostLayers = false
      const drawRoomsAtZLevelSpy = vi.spyOn(renderer, 'drawRoomsAtZLevel')

      renderer.render()

      // Should only draw current z-level (1.0 opacity), not ghost levels
      expect(drawRoomsAtZLevelSpy).toHaveBeenCalledTimes(1)
      expect(drawRoomsAtZLevelSpy).toHaveBeenCalledWith(mockCtx, mockState, 0, 1.0)
    })

    it('draws NPC paths when showNPCPaths is true', () => {
      mockState.showNPCPaths = true
      const drawNPCPathsSpy = vi.spyOn(renderer, 'drawNPCPaths')

      renderer.render()

      expect(drawNPCPathsSpy).toHaveBeenCalledWith(mockCtx, mockState)
    })

    it('does not draw NPC paths when showNPCPaths is false', () => {
      mockState.showNPCPaths = false
      const drawNPCPathsSpy = vi.spyOn(renderer, 'drawNPCPaths')

      renderer.render()

      expect(drawNPCPathsSpy).not.toHaveBeenCalled()
    })

    it('draws snap indicator when dragging and snap position exists', () => {
      mockState.snapIndicator = { x: 1, y: 2 }
      mockState.isDraggingRoom = true
      const drawSnapIndicatorSpy = vi.spyOn(renderer, 'drawSnapIndicator')

      renderer.render()

      expect(drawSnapIndicatorSpy).toHaveBeenCalledWith(mockCtx, mockState)
    })

    it('does not draw snap indicator when not dragging', () => {
      mockState.snapIndicator = { x: 1, y: 2 }
      mockState.isDraggingRoom = false
      const drawSnapIndicatorSpy = vi.spyOn(renderer, 'drawSnapIndicator')

      renderer.render()

      expect(drawSnapIndicatorSpy).not.toHaveBeenCalled()
    })

    it('always draws exits for current Z-level', () => {
      const drawExitsSpy = vi.spyOn(renderer, 'drawExits')

      renderer.render()

      expect(drawExitsSpy).toHaveBeenCalledWith(mockCtx, mockState)
    })

    it('always draws rooms at current Z-level with full opacity', () => {
      mockState.currentZLevel = 0
      const drawRoomsAtZLevelSpy = vi.spyOn(renderer, 'drawRoomsAtZLevel')

      renderer.render()

      expect(drawRoomsAtZLevelSpy).toHaveBeenCalledWith(mockCtx, mockState, 0, 1.0)
    })
  })

  // ============================================================================
  // Grid Drawing
  // ============================================================================

  describe('drawGrid()', () => {
    it('sets grid stroke style from viewport colors', () => {
      // Track strokeStyle values when they're set
      const strokeStyles = []
      Object.defineProperty(mockCtx, 'strokeStyle', {
        set: (v) => strokeStyles.push(v),
        get: () => strokeStyles[strokeStyles.length - 1],
      })

      renderer.drawGrid(mockCtx, mockState)

      // First stroke style should be grid color
      expect(strokeStyles[0]).toBe(mockState.viewportColors.grid)
    })

    it('scales line width based on zoom', () => {
      const lineWidths = []
      Object.defineProperty(mockCtx, 'lineWidth', {
        set: (v) => lineWidths.push(v),
        get: () => lineWidths[lineWidths.length - 1],
      })

      mockState.camera.zoom = 2
      renderer.drawGrid(mockCtx, mockState)

      // First line width should be 1 / zoom
      expect(lineWidths[0]).toBe(0.5)
    })

    it('draws grid lines with beginPath and stroke', () => {
      renderer.drawGrid(mockCtx, mockState)

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })

    it('uses moveTo and lineTo for grid lines', () => {
      renderer.drawGrid(mockCtx, mockState)

      expect(mockCtx.moveTo).toHaveBeenCalled()
      expect(mockCtx.lineTo).toHaveBeenCalled()
    })

    it('draws origin crosshair with major grid color', () => {
      renderer.drawGrid(mockCtx, mockState)

      // Origin crosshair uses gridMajor color and thicker line
      expect(mockCtx.strokeStyle).toBe(mockState.viewportColors.gridMajor)
    })

    it('draws origin crosshair with scaled line width', () => {
      mockState.camera.zoom = 2
      renderer.drawGrid(mockCtx, mockState)

      // Origin crosshair is 2 / zoom
      expect(mockCtx.lineWidth).toBe(1) // 2 / 2
    })
  })

  // ============================================================================
  // NPC Paths Drawing
  // ============================================================================

  describe('drawNPCPaths()', () => {
    it('does nothing when no NPC paths exist', () => {
      mockState.npcPaths = {}
      renderer.drawNPCPaths(mockCtx, mockState)

      expect(mockCtx.save).not.toHaveBeenCalled()
    })

    it('skips paths without patrol info', () => {
      mockState.npcPaths = { guard: {} }
      renderer.drawNPCPaths(mockCtx, mockState)

      expect(mockCtx.save).not.toHaveBeenCalled()
    })

    it('skips paths with less than 2 rooms in route', () => {
      mockState.npcPaths = { guard: { patrol: { route: ['room1'] } } }
      renderer.drawNPCPaths(mockCtx, mockState)

      expect(mockCtx.save).not.toHaveBeenCalled()
    })

    it('draws path for valid NPC patrol', () => {
      const state = createStateWithRooms({
        npcPaths: {
          guard: { patrol: { route: ['town_square', 'market'], loop: true } },
        },
      })

      renderer.drawNPCPaths(mockCtx, state)

      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })

    it('sets dashed line style for patrol paths', () => {
      const state = createStateWithRooms({
        npcPaths: {
          guard: { patrol: { route: ['town_square', 'market'], loop: true } },
        },
      })

      renderer.drawNPCPaths(mockCtx, state)

      expect(mockCtx.setLineDash).toHaveBeenCalled()
    })

    it('draws path arrows along the route', () => {
      const state = createStateWithRooms({
        npcPaths: {
          guard: { patrol: { route: ['town_square', 'market'], loop: false } },
        },
      })
      const drawPathArrowsSpy = vi.spyOn(renderer, 'drawPathArrows')

      renderer.drawNPCPaths(mockCtx, state)

      expect(drawPathArrowsSpy).toHaveBeenCalled()
    })

    it('uses distinct colors for different NPC paths', () => {
      const state = createStateWithRooms({
        npcPaths: {
          guard: { patrol: { route: ['town_square', 'market'], loop: true } },
          merchant: { patrol: { route: ['market', 'town_square'], loop: true } },
        },
      })

      // Track stroke styles to verify different colors are used
      const strokeStyles = []
      Object.defineProperty(mockCtx, 'strokeStyle', {
        set: (v) => strokeStyles.push(v),
        get: () => strokeStyles[strokeStyles.length - 1],
      })

      renderer.drawNPCPaths(mockCtx, state)

      // Should have different colors for each path
      expect(strokeStyles.length).toBeGreaterThanOrEqual(2)
      // First two stroke styles should be different colors from palette
      expect(strokeStyles[0]).not.toBe(strokeStyles[1])
    })
  })

  // ============================================================================
  // Path Arrows Drawing
  // ============================================================================

  describe('drawPathArrows()', () => {
    it('draws arrows at midpoint between rooms', () => {
      const state = createStateWithRooms()
      const route = ['town_square', 'market']
      const color = '#ff6b6b'

      renderer.drawPathArrows(mockCtx, state, route, color)

      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.translate).toHaveBeenCalled()
      expect(mockCtx.rotate).toHaveBeenCalled()
      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.fill).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('skips arrows for rooms not found in roomsByKey', () => {
      const state = createStateWithRooms()
      const route = ['town_square', 'nonexistent_room']

      renderer.drawPathArrows(mockCtx, state, route, '#ff6b6b')

      // Should not throw, should skip the invalid room pair
      expect(mockCtx.save).not.toHaveBeenCalled()
    })

    it('skips arrows for rooms on different Z levels', () => {
      const state = createStateWithRooms({ currentZLevel: 0 })
      // cellar is at z=-1, tower_top is at z=1
      const route = ['tavern', 'cellar']

      renderer.drawPathArrows(mockCtx, state, route, '#ff6b6b')

      // Should not draw arrow because cellar is on z=-1
      expect(mockCtx.save).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Exits Drawing
  // ============================================================================

  describe('drawExits()', () => {
    it('draws exit connections between rooms on same Z level', () => {
      const state = createStateWithRooms({ currentZLevel: 0 })
      const drawExitArrowSpy = vi.spyOn(renderer, 'drawExitArrow')

      renderer.drawExits(mockCtx, state)

      // town_square has exits to market and tavern (both on z=0)
      expect(drawExitArrowSpy).toHaveBeenCalled()
    })

    it('skips up/down exits (shown as indicators instead)', () => {
      const state = createStateWithRooms({ currentZLevel: 0 })
      const drawExitArrowSpy = vi.spyOn(renderer, 'drawExitArrow')

      renderer.drawExits(mockCtx, state)

      // tavern has a 'down' exit to cellar, but it should be skipped
      const calls = drawExitArrowSpy.mock.calls
      const exitDirections = calls.map((call) => call[4]) // direction is 5th arg
      expect(exitDirections).not.toContain('up')
      expect(exitDirections).not.toContain('down')
    })

    it('skips exits to rooms on different Z levels', () => {
      const state = createStateWithRooms({ currentZLevel: 1 })
      const drawExitArrowSpy = vi.spyOn(renderer, 'drawExitArrow')

      renderer.drawExits(mockCtx, state)

      // At z=1, tower_top only has a 'down' exit which should be skipped
      // No other exits exist at z=1
      expect(drawExitArrowSpy).not.toHaveBeenCalled()
    })

    it('skips exits to nonexistent destination rooms', () => {
      const state = createMockState({
        rooms: [
          {
            key: 'orphan',
            name: 'Orphan Room',
            x: 0,
            y: 0,
            z: 0,
            exits: { north: 'nonexistent' },
          },
        ],
        roomsByKey: new Map([
          [
            'orphan',
            {
              key: 'orphan',
              name: 'Orphan Room',
              x: 0,
              y: 0,
              z: 0,
              exits: { north: 'nonexistent' },
            },
          ],
        ]),
      })
      const drawExitArrowSpy = vi.spyOn(renderer, 'drawExitArrow')

      renderer.drawExits(mockCtx, state)

      expect(drawExitArrowSpy).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Exit Arrow Drawing
  // ============================================================================

  describe('drawExitArrow()', () => {
    it('draws a line from source to destination room', () => {
      const state = createStateWithRooms()
      const fromRoom = state.rooms[0] // town_square
      const toRoom = state.rooms[1] // market

      renderer.drawExitArrow(mockCtx, state, fromRoom, toRoom, 'north')

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.moveTo).toHaveBeenCalled()
      expect(mockCtx.lineTo).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })

    it('sets line cap to round', () => {
      const state = createStateWithRooms()
      const fromRoom = state.rooms[0]
      const toRoom = state.rooms[1]

      renderer.drawExitArrow(mockCtx, state, fromRoom, toRoom, 'north')

      expect(mockCtx.lineCap).toBe('round')
    })

    it('scales line width based on zoom', () => {
      const state = createStateWithRooms({ camera: { x: 0, y: 0, zoom: 2 } })
      const fromRoom = state.rooms[0]
      const toRoom = state.rooms[1]

      renderer.drawExitArrow(mockCtx, state, fromRoom, toRoom, 'north')

      expect(mockCtx.lineWidth).toBe(1.5) // 3 / zoom
    })

    it('does not draw when rooms are at same position', () => {
      const state = createStateWithRooms()
      const room = state.rooms[0]

      renderer.drawExitArrow(mockCtx, state, room, room, 'north')

      // Should return early, no stroke call
      expect(mockCtx.stroke).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Rooms Drawing
  // ============================================================================

  describe('drawRoomsAtZLevel()', () => {
    it('draws only rooms at specified Z level', () => {
      const state = createStateWithRooms()
      const drawRoomSpy = vi.spyOn(renderer, 'drawRoom')

      renderer.drawRoomsAtZLevel(mockCtx, state, 0, 1.0)

      // Rooms at z=0: town_square, market, tavern (3 rooms)
      expect(drawRoomSpy).toHaveBeenCalledTimes(3)
    })

    it('passes correct opacity to drawRoom', () => {
      const state = createStateWithRooms()
      const drawRoomSpy = vi.spyOn(renderer, 'drawRoom')

      renderer.drawRoomsAtZLevel(mockCtx, state, 0, 0.2)

      // All calls should have opacity 0.2
      drawRoomSpy.mock.calls.forEach((call) => {
        expect(call[3]).toBe(0.2)
      })
    })

    it('draws no rooms when none exist at Z level', () => {
      const state = createStateWithRooms()
      const drawRoomSpy = vi.spyOn(renderer, 'drawRoom')

      renderer.drawRoomsAtZLevel(mockCtx, state, 5, 1.0)

      expect(drawRoomSpy).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Room Drawing
  // ============================================================================

  describe('drawRoom()', () => {
    it('draws room rectangle with rounded corners', () => {
      const state = createStateWithRooms()
      const room = state.rooms[0]
      const roundRectSpy = vi.spyOn(renderer, 'roundRect')

      renderer.drawRoom(mockCtx, state, room)

      expect(roundRectSpy).toHaveBeenCalled()
      expect(mockCtx.fill).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })

    it('uses default color for unselected room', () => {
      const state = createStateWithRooms({ selectedRoom: null })
      const room = state.rooms[0]

      // Track fill styles
      const fillStyles = []
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: (v) => fillStyles.push(v),
        get: () => fillStyles[fillStyles.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room)

      // First fill style (for room rectangle) should be default color
      expect(fillStyles[0]).toBe(state.roomColors.default)
    })

    it('uses selected color for selected room', () => {
      const state = createStateWithRooms({ selectedRoom: 'town_square' })
      const room = state.rooms[0]

      const fillStyles = []
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: (v) => fillStyles.push(v),
        get: () => fillStyles[fillStyles.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room)

      expect(fillStyles[0]).toBe(state.roomColors.selected)
    })

    it('uses multiSelected color for multi-selected room', () => {
      const state = createStateWithRooms({
        selectedRoom: null,
        selectedKeys: new Set(['town_square']),
      })
      const room = state.rooms[0]

      const fillStyles = []
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: (v) => fillStyles.push(v),
        get: () => fillStyles[fillStyles.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room)

      expect(fillStyles[0]).toBe(state.roomColors.multiSelected)
    })

    it('uses error color for room with validation errors', () => {
      const state = createStateWithRooms({
        validation: { town_square: { status: 'error', errors: ['Missing description'] } },
      })
      const room = state.rooms[0]

      const fillStyles = []
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: (v) => fillStyles.push(v),
        get: () => fillStyles[fillStyles.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room)

      expect(fillStyles[0]).toBe(state.roomColors.error)
    })

    it('uses warning color for room with validation warnings', () => {
      const state = createStateWithRooms({
        validation: { town_square: { status: 'warning', warnings: ['Consider adding items'] } },
      })
      const room = state.rooms[0]

      const fillStyles = []
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: (v) => fillStyles.push(v),
        get: () => fillStyles[fillStyles.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room)

      expect(fillStyles[0]).toBe(state.roomColors.warning)
    })

    it('uses zone color when showZoneColors is true', () => {
      const state = createStateWithRooms({
        showZoneColors: true,
        zoneColors: { town: '#228b22' },
        roomZoneMap: { town_square: 'town' },
      })
      const room = state.rooms[0]

      const fillStyles = []
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: (v) => fillStyles.push(v),
        get: () => fillStyles[fillStyles.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room)

      expect(fillStyles[0]).toBe('#228b22')
    })

    it('sets globalAlpha for opacity', () => {
      const state = createStateWithRooms()
      const room = state.rooms[0]

      const alphas = []
      Object.defineProperty(mockCtx, 'globalAlpha', {
        set: (v) => alphas.push(v),
        get: () => alphas[alphas.length - 1],
      })

      renderer.drawRoom(mockCtx, state, room, 0.5)

      // First alpha should be the requested opacity
      expect(alphas[0]).toBe(0.5)
    })

    it('resets globalAlpha to 1 after drawing', () => {
      const state = createStateWithRooms()
      const room = state.rooms[0]

      renderer.drawRoom(mockCtx, state, room, 0.5)

      // Last globalAlpha assignment should be 1
      expect(mockCtx.globalAlpha).toBe(1)
    })

    it('draws room name when zoom >= 0.5', () => {
      const state = createStateWithRooms({ camera: { x: 0, y: 0, zoom: 0.5 } })
      const room = state.rooms[0]

      renderer.drawRoom(mockCtx, state, room)

      expect(mockCtx.fillText).toHaveBeenCalled()
    })

    it('does not draw labels when zoom < 0.5', () => {
      const state = createStateWithRooms({ camera: { x: 0, y: 0, zoom: 0.4 } })
      const room = state.rooms[0]

      renderer.drawRoom(mockCtx, state, room)

      // Only fillRect for room shape, no fillText for labels
      expect(mockCtx.fillText).not.toHaveBeenCalled()
    })

    it('draws room key when zoom >= 0.8', () => {
      const state = createStateWithRooms({ camera: { x: 0, y: 0, zoom: 0.8 } })
      const room = state.rooms[0]

      renderer.drawRoom(mockCtx, state, room)

      // fillText called twice: once for name, once for key
      expect(mockCtx.fillText).toHaveBeenCalledTimes(2)
    })

    it('calls drawEntityIndicators', () => {
      const state = createStateWithRooms({ camera: { x: 0, y: 0, zoom: 1 } })
      const room = state.rooms[1] // market has NPCs
      const drawEntityIndicatorsSpy = vi.spyOn(renderer, 'drawEntityIndicators')

      renderer.drawRoom(mockCtx, state, room)

      expect(drawEntityIndicatorsSpy).toHaveBeenCalled()
    })

    it('calls drawVerticalExitIndicators', () => {
      const state = createStateWithRooms({ camera: { x: 0, y: 0, zoom: 1 } })
      const room = state.rooms[2] // tavern has down exit
      const drawVerticalExitIndicatorsSpy = vi.spyOn(renderer, 'drawVerticalExitIndicators')

      renderer.drawRoom(mockCtx, state, room)

      expect(drawVerticalExitIndicatorsSpy).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Entity Indicators
  // ============================================================================

  describe('drawEntityIndicators()', () => {
    it('does nothing when room has no spawns', () => {
      const state = createStateWithRooms()
      const room = state.rooms[0] // town_square has no spawns

      renderer.drawEntityIndicators(mockCtx, state, room, 0, 0, 24)

      expect(mockCtx.fillText).not.toHaveBeenCalled()
    })

    it('draws NPC indicator for room with NPCs', () => {
      const state = createStateWithRooms()
      const room = state.rooms[1] // market has npcs

      renderer.drawEntityIndicators(mockCtx, state, room, 0, 0, 24)

      expect(mockCtx.fillText).toHaveBeenCalled()
    })

    it('draws item indicator for room with items', () => {
      const state = createStateWithRooms()
      const room = state.rooms[2] // tavern has items

      renderer.drawEntityIndicators(mockCtx, state, room, 0, 0, 24)

      expect(mockCtx.fillText).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Vertical Exit Indicators
  // ============================================================================

  describe('drawVerticalExitIndicators()', () => {
    it('does nothing when room has no vertical exits', () => {
      const state = createStateWithRooms()
      const room = state.rooms[0] // town_square has no up/down

      renderer.drawVerticalExitIndicators(mockCtx, state, room, 0, 0, 24)

      expect(mockCtx.fillText).not.toHaveBeenCalled()
    })

    it('draws down arrow for room with down exit', () => {
      const state = createStateWithRooms()
      const room = state.rooms[2] // tavern has down exit

      renderer.drawVerticalExitIndicators(mockCtx, state, room, 0, 0, 24)

      expect(mockCtx.fillText).toHaveBeenCalled()
    })

    it('draws up arrow for room with up exit', () => {
      const state = createStateWithRooms()
      const room = state.rooms[3] // cellar has up exit

      renderer.drawVerticalExitIndicators(mockCtx, state, room, 0, 0, 24)

      expect(mockCtx.fillText).toHaveBeenCalled()
    })

    it('draws both arrows for room with both up and down exits', () => {
      const state = createMockState({
        rooms: [{ key: 'stairwell', name: 'Stairwell', x: 0, y: 0, z: 0, exits: { up: 'a', down: 'b' } }],
        roomsByKey: new Map([
          ['stairwell', { key: 'stairwell', name: 'Stairwell', x: 0, y: 0, z: 0, exits: { up: 'a', down: 'b' } }],
        ]),
      })
      const room = state.rooms[0]

      renderer.drawVerticalExitIndicators(mockCtx, state, room, 0, 0, 24)

      // Should draw both arrows
      expect(mockCtx.fillText).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // Snap Indicator
  // ============================================================================

  describe('drawSnapIndicator()', () => {
    it('does nothing when snapIndicator is null', () => {
      const state = createMockState({ snapIndicator: null })

      renderer.drawSnapIndicator(mockCtx, state)

      expect(mockCtx.save).not.toHaveBeenCalled()
    })

    it('draws crosshairs at snap position', () => {
      const state = createMockState({ snapIndicator: { x: 1, y: 2 } })

      renderer.drawSnapIndicator(mockCtx, state)

      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.moveTo).toHaveBeenCalled()
      expect(mockCtx.lineTo).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('draws circle at snap point', () => {
      const state = createMockState({ snapIndicator: { x: 1, y: 2 } })

      renderer.drawSnapIndicator(mockCtx, state)

      expect(mockCtx.arc).toHaveBeenCalled()
    })

    it('uses snap color from viewport colors', () => {
      const state = createMockState({ snapIndicator: { x: 1, y: 2 } })

      const strokeStyles = []
      Object.defineProperty(mockCtx, 'strokeStyle', {
        set: (v) => strokeStyles.push(v),
        get: () => strokeStyles[strokeStyles.length - 1],
      })

      renderer.drawSnapIndicator(mockCtx, state)

      // First stroke style should be snap color
      expect(strokeStyles[0]).toBe(state.viewportColors.snap)
    })

    it('draws highlighted grid lines at snap position', () => {
      const state = createMockState({ snapIndicator: { x: 1, y: 2 } })

      renderer.drawSnapIndicator(mockCtx, state)

      // Should use snapDim color for grid highlights
      expect(mockCtx.strokeStyle).toBe(state.viewportColors.snapDim)
    })
  })

  // ============================================================================
  // Helper: roundRect
  // ============================================================================

  describe('roundRect()', () => {
    it('draws a closed path with rounded corners', () => {
      renderer.roundRect(mockCtx, 0, 0, 100, 100, 10)

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.moveTo).toHaveBeenCalled()
      expect(mockCtx.lineTo).toHaveBeenCalled()
      expect(mockCtx.quadraticCurveTo).toHaveBeenCalledTimes(4) // 4 corners
      expect(mockCtx.closePath).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Helper: truncateText
  // ============================================================================

  describe('truncateText()', () => {
    it('returns empty string for null/undefined text', () => {
      expect(renderer.truncateText(null, 100, mockCtx, 12)).toBe('')
      expect(renderer.truncateText(undefined, 100, mockCtx, 12)).toBe('')
      expect(renderer.truncateText('', 100, mockCtx, 12)).toBe('')
    })

    it('returns text unchanged if it fits within maxWidth', () => {
      mockCtx.measureText = vi.fn(() => ({ width: 30 }))

      const result = renderer.truncateText('Hello', 100, mockCtx, 12)

      expect(result).toBe('Hello')
    })

    it('truncates text with ellipsis when too wide', () => {
      // First call checks full text width (too wide)
      // Subsequent calls check truncated versions
      let callCount = 0
      mockCtx.measureText = vi.fn(() => {
        callCount++
        if (callCount === 1) return { width: 200 } // Full text too wide
        return { width: 50 } // Truncated fits
      })

      const result = renderer.truncateText('Hello World', 100, mockCtx, 12)

      expect(result).toContain('\u2026') // Contains ellipsis
    })

    it('caches truncation results', () => {
      mockCtx.measureText = vi.fn(() => ({ width: 30 }))

      // First call
      renderer.truncateText('Hello', 100, mockCtx, 12)
      expect(renderer.truncateCacheSize).toBe(1)

      // Second call with same params should use cache
      renderer.truncateText('Hello', 100, mockCtx, 12)
      expect(renderer.truncateCacheSize).toBe(1) // Still 1, used cache
    })

    it('uses different cache keys for different params', () => {
      mockCtx.measureText = vi.fn(() => ({ width: 30 }))

      renderer.truncateText('Hello', 100, mockCtx, 12)
      renderer.truncateText('Hello', 100, mockCtx, 14) // Different font size
      renderer.truncateText('World', 100, mockCtx, 12) // Different text

      expect(renderer.truncateCacheSize).toBe(3)
    })

    it('evicts cache when exceeding max size', () => {
      // Make measureText return a value greater than maxWidth to trigger truncation
      // which is the code path that evicts the cache
      let callCount = 0
      mockCtx.measureText = vi.fn(() => {
        callCount++
        // First call (full text) returns too wide, subsequent calls fit
        if (callCount % 3 === 1) return { width: 200 }
        return { width: 50 }
      })

      // Fill cache beyond max (500) using truncated text path
      for (let i = 0; i < 510; i++) {
        renderer.truncateText(`text_that_needs_truncation_${i}`, 100, mockCtx, 12)
      }

      // Cache should have been cleared at some point
      // After clearing, only new entries are added
      expect(renderer.truncateCacheSize).toBeLessThanOrEqual(10)
    })
  })
})
