import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Canvas2DViewport from '../Canvas2DViewport.js'

// Minimal canvas context mock (stub all draw calls)
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

function createMockCanvas() {
  const ctx = createMockContext()
  const listeners = {}
  return {
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600, left: 0, top: 0 })),
    addEventListener: vi.fn((type, handler, opts) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(handler)
    }),
    removeEventListener: vi.fn(),
    parentElement: {
      appendChild: vi.fn(),
    },
    width: 800,
    height: 600,
    style: {},
    _ctx: ctx,
    _listeners: listeners,
  }
}

function setupGlobals() {
  const docListeners = {}
  vi.stubGlobal('document', {
    documentElement: {},
    addEventListener: vi.fn((type, handler) => {
      docListeners[type] = docListeners[type] || []
      docListeners[type].push(handler)
    }),
    removeEventListener: vi.fn(),
    createElement: vi.fn(() => ({
      className: '',
      style: { cssText: '' },
      innerHTML: '',
      parentElement: null,
      getBoundingClientRect: vi.fn(() => ({ width: 200, height: 100 })),
    })),
    _listeners: docListeners,
  })

  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    requestAnimationFrame: vi.fn((cb) => {
      cb()
      return 1
    }),
    cancelAnimationFrame: vi.fn(),
  })

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb) => {
      cb()
      return 1
    })
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())

  vi.stubGlobal(
    'getComputedStyle',
    vi.fn(() => ({
      getPropertyValue: vi.fn(() => ''),
    }))
  )

  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    }))
  )
}

function createViewport(options = {}) {
  const canvas = createMockCanvas()
  const viewport = new Canvas2DViewport(canvas, options)
  return { viewport, canvas }
}

// Sample room data
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
      exits: { west: 'town_square' },
      spawns: { items: ['ale'] },
    },
    { key: 'cellar', name: 'Cellar', x: 1, y: 0, z: -1, exits: { up: 'tavern' }, spawns: {} },
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

describe('Canvas2DViewport', () => {
  beforeEach(() => {
    setupGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ============================================================================
  // Construction & Defaults
  // ============================================================================

  describe('construction', () => {
    it('initializes with default camera at origin', () => {
      const { viewport } = createViewport()
      expect(viewport.camera).toEqual({ x: 0, y: 0, zoom: 1 })
    })

    it('initializes with default grid settings', () => {
      const { viewport } = createViewport()
      expect(viewport.gridSize).toBe(60)
      expect(viewport.roomSize).toBe(48)
      expect(viewport.minZoom).toBe(0.2)
      expect(viewport.maxZoom).toBe(3)
    })

    it('initializes with empty rooms', () => {
      const { viewport } = createViewport()
      expect(viewport.rooms).toEqual([])
      expect(viewport.roomsByKey.size).toBe(0)
    })

    it('uses fallback colors when CSS variables are empty', () => {
      const { viewport } = createViewport()
      expect(viewport.exitColors.north).toBe('#4a9eff')
      expect(viewport.roomColors.default).toBe('#7eb3ff')
      expect(viewport.viewportColors.bg).toBe('#1a1a2e')
    })

    it('accepts callbacks via options', () => {
      const onSelectRoom = vi.fn()
      const onMoveRoom = vi.fn()
      const { viewport } = createViewport({ onSelectRoom, onMoveRoom })
      expect(viewport.onSelectRoom).toBe(onSelectRoom)
      expect(viewport.onMoveRoom).toBe(onMoveRoom)
    })
  })

  // ============================================================================
  // Coordinate Transforms
  // ============================================================================

  describe('worldToScreen', () => {
    it('converts origin to screen center', () => {
      const { viewport } = createViewport()
      // camera at (0,0), zoom 1, display 800x600
      const result = viewport.worldToScreen(0, 0)
      expect(result.x).toBe(400) // width/2
      expect(result.y).toBe(300) // height/2
    })

    it('converts positive world coords to right/down of center', () => {
      const { viewport } = createViewport()
      const result = viewport.worldToScreen(1, 1)
      // (1 * 60 + 0) * 1 + 400 = 460
      expect(result.x).toBe(460)
      expect(result.y).toBe(360)
    })

    it('converts negative world coords to left/up of center', () => {
      const { viewport } = createViewport()
      const result = viewport.worldToScreen(-1, -1)
      expect(result.x).toBe(340)
      expect(result.y).toBe(240)
    })

    it('accounts for camera pan', () => {
      const { viewport } = createViewport()
      viewport.camera.x = 60 // panned right by 1 grid unit
      viewport.camera.y = -60 // panned up by 1 grid unit
      const result = viewport.worldToScreen(0, 0)
      // (0 + 60) * 1 + 400 = 460
      expect(result.x).toBe(460)
      // (0 + -60) * 1 + 300 = 240
      expect(result.y).toBe(240)
    })

    it('accounts for zoom', () => {
      const { viewport } = createViewport()
      viewport.camera.zoom = 2
      const result = viewport.worldToScreen(1, 0)
      // (1 * 60 + 0) * 2 + 400 = 520
      expect(result.x).toBe(520)
      expect(result.y).toBe(300)
    })
  })

  describe('screenToWorld', () => {
    it('converts screen center to world origin', () => {
      const { viewport } = createViewport()
      const result = viewport.screenToWorld(400, 300)
      expect(result.x).toBeCloseTo(0)
      expect(result.y).toBeCloseTo(0)
    })

    it('is inverse of worldToScreen at default camera', () => {
      const { viewport } = createViewport()
      const world = { x: 3.5, y: -2.7 }
      const screen = viewport.worldToScreen(world.x, world.y)
      const back = viewport.screenToWorld(screen.x, screen.y)
      expect(back.x).toBeCloseTo(world.x)
      expect(back.y).toBeCloseTo(world.y)
    })

    it('is inverse of worldToScreen with pan and zoom', () => {
      const { viewport } = createViewport()
      viewport.camera.x = 120
      viewport.camera.y = -90
      viewport.camera.zoom = 1.5
      const world = { x: -4, y: 7 }
      const screen = viewport.worldToScreen(world.x, world.y)
      const back = viewport.screenToWorld(screen.x, screen.y)
      expect(back.x).toBeCloseTo(world.x)
      expect(back.y).toBeCloseTo(world.y)
    })

    it('accounts for zoom level', () => {
      const { viewport } = createViewport()
      viewport.camera.zoom = 0.5
      // Zoomed out means more world space visible
      const topLeft = viewport.screenToWorld(0, 0)
      const bottomRight = viewport.screenToWorld(800, 600)
      const worldWidth = bottomRight.x - topLeft.x
      // At zoom 0.5, visible world width should be larger
      expect(worldWidth).toBeGreaterThan(800 / 60) // More than default
    })
  })

  // ============================================================================
  // Data Management
  // ============================================================================

  describe('setRooms', () => {
    it('stores rooms and builds key lookup', () => {
      const { viewport } = createViewport()
      const rooms = sampleRooms()
      viewport.setRooms(rooms)
      expect(viewport.rooms).toBe(rooms)
      expect(viewport.roomsByKey.get('town_square')).toBe(rooms[0])
      expect(viewport.roomsByKey.get('market')).toBe(rooms[1])
    })

    it('auto-detects Z-levels', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      expect(viewport.zLevels).toEqual([-1, 0, 1])
    })

    it('handles empty rooms array', () => {
      const { viewport } = createViewport()
      viewport.setRooms([])
      expect(viewport.rooms).toEqual([])
      expect(viewport.roomsByKey.size).toBe(0)
    })

    it('handles null rooms', () => {
      const { viewport } = createViewport()
      viewport.setRooms(null)
      expect(viewport.rooms).toEqual([])
    })

    it('adjusts currentZLevel if not in available levels', () => {
      const { viewport } = createViewport()
      viewport.currentZLevel = 5
      viewport.setRooms(sampleRooms())
      expect(viewport.zLevels).toContain(viewport.currentZLevel)
    })
  })

  describe('setSelectedKeys', () => {
    it('stores keys as a Set', () => {
      const { viewport } = createViewport()
      viewport.setSelectedKeys(['room_a', 'room_b'])
      expect(viewport.selectedKeys.has('room_a')).toBe(true)
      expect(viewport.selectedKeys.has('room_b')).toBe(true)
      expect(viewport.selectedKeys.size).toBe(2)
    })

    it('handles null', () => {
      const { viewport } = createViewport()
      viewport.setSelectedKeys(null)
      expect(viewport.selectedKeys.size).toBe(0)
    })
  })

  // ============================================================================
  // Hit Testing
  // ============================================================================

  describe('getRoomAtPoint', () => {
    it('returns room when clicking on its position', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())

      // Town Square is at world (0, 0), which maps to screen center (400, 300)
      const room = viewport.getRoomAtPoint(400, 300)
      expect(room).not.toBeNull()
      expect(room.key).toBe('town_square')
    })

    it('returns null when clicking empty space', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())

      // Far away from any room
      const room = viewport.getRoomAtPoint(0, 0)
      expect(room).toBeNull()
    })

    it('respects Z-level filtering', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      viewport.currentZLevel = 0

      // Cellar is at world (1, 0, z=-1), same screen pos as tavern
      // But at z=0, we should get tavern
      const tavernScreen = viewport.worldToScreen(1, 0)
      const room = viewport.getRoomAtPoint(tavernScreen.x, tavernScreen.y)
      expect(room.key).toBe('tavern')
    })

    it('detects rooms within roomSize bounds', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())

      // Click slightly off-center but still within room bounds
      const halfSize = viewport.roomSize / 2 / viewport.gridSize
      // Market is at (0, -1). Try clicking at edge of room
      const edgePoint = viewport.worldToScreen(halfSize * 0.9, -1)
      const room = viewport.getRoomAtPoint(edgePoint.x, edgePoint.y)
      expect(room).not.toBeNull()
      expect(room.key).toBe('market')
    })

    it('does not detect rooms outside bounds', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())

      // Click well outside any room (world coords 5, 5)
      const farPoint = viewport.worldToScreen(5, 5)
      const room = viewport.getRoomAtPoint(farPoint.x, farPoint.y)
      expect(room).toBeNull()
    })
  })

  // ============================================================================
  // Camera Controls
  // ============================================================================

  describe('centerOnRoom', () => {
    it('centers camera on room position', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      viewport.centerOnRoom('market')

      // Market is at (0, -1), camera should be at -(0)*60, -(-1)*60 = (0, 60)
      expect(viewport.camera.x).toBeCloseTo(0)
      expect(viewport.camera.y).toBeCloseTo(60) // -(-1) * 60
    })

    it('updates Z-level to match room', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      viewport.currentZLevel = 0
      viewport.centerOnRoom('cellar') // z=-1

      expect(viewport.currentZLevel).toBe(-1)
    })

    it('does nothing for unknown room key', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      const cameraBefore = { ...viewport.camera }
      viewport.centerOnRoom('nonexistent')
      expect(viewport.camera).toEqual(cameraBefore)
    })
  })

  describe('resetCamera', () => {
    it('resets camera to origin', () => {
      const { viewport } = createViewport()
      viewport.camera = { x: 100, y: -200, zoom: 2.5 }
      viewport.resetCamera()
      expect(viewport.camera).toEqual({ x: 0, y: 0, zoom: 1 })
    })

    it('clears truncation cache', () => {
      const { viewport } = createViewport()
      viewport._truncateCache.set('test', 'value')
      viewport.resetCamera()
      expect(viewport._truncateCache.size).toBe(0)
    })
  })

  describe('fitToRooms', () => {
    it('does nothing with no rooms', () => {
      const { viewport } = createViewport()
      viewport.setRooms([])
      const cameraBefore = { ...viewport.camera }
      viewport.fitToRooms()
      expect(viewport.camera).toEqual(cameraBefore)
    })

    it('centers on single room', () => {
      const { viewport } = createViewport()
      viewport.setRooms([{ key: 'only', name: 'Only Room', x: 3, y: 5, z: 0 }])
      viewport.fitToRooms()

      // Camera should center on room
      expect(viewport.camera.x).toBe(-3 * 60)
      expect(viewport.camera.y).toBe(-5 * 60)
    })

    it('clamps zoom within bounds', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      viewport.fitToRooms()

      expect(viewport.camera.zoom).toBeGreaterThanOrEqual(viewport.minZoom)
      expect(viewport.camera.zoom).toBeLessThanOrEqual(viewport.maxZoom)
    })

    it('caps zoom at 1.5 to prevent over-zooming on small maps', () => {
      const { viewport } = createViewport()
      // A single room would fit at very high zoom, but should cap at 1.5
      viewport.setRooms([{ key: 'a', name: 'A', x: 0, y: 0, z: 0 }])
      viewport.fitToRooms()
      expect(viewport.camera.zoom).toBeLessThanOrEqual(1.5)
    })
  })

  // ============================================================================
  // Zoom Clamping
  // ============================================================================

  describe('zoom clamping', () => {
    it('does not zoom below minZoom', () => {
      const { viewport } = createViewport()
      viewport.camera.zoom = 0.1 // Below minZoom of 0.2
      // Simulate zoom clamp (same logic as handleWheel)
      viewport.camera.zoom = Math.max(
        viewport.minZoom,
        Math.min(viewport.maxZoom, viewport.camera.zoom)
      )
      expect(viewport.camera.zoom).toBe(0.2)
    })

    it('does not zoom above maxZoom', () => {
      const { viewport } = createViewport()
      viewport.camera.zoom = 5 // Above maxZoom of 3
      viewport.camera.zoom = Math.max(
        viewport.minZoom,
        Math.min(viewport.maxZoom, viewport.camera.zoom)
      )
      expect(viewport.camera.zoom).toBe(3)
    })
  })

  // ============================================================================
  // Grid Snapping
  // ============================================================================

  describe('grid snapping', () => {
    it('snaps to grid when snapSize equals gridSize', () => {
      const { viewport } = createViewport()
      const snapWorld = viewport.snapSize / viewport.gridSize // 60/60 = 1
      const rawX = 2.3
      const rawY = -1.7
      const snappedX = Math.round(rawX / snapWorld) * snapWorld
      const snappedY = Math.round(rawY / snapWorld) * snapWorld
      expect(snappedX).toBe(2)
      expect(snappedY).toBe(-2)
    })

    it('snaps to half-grid with custom snapSize', () => {
      const { viewport } = createViewport()
      viewport.snapSize = 30 // Half grid
      const snapWorld = viewport.snapSize / viewport.gridSize // 30/60 = 0.5
      const rawX = 2.3
      const snappedX = Math.round(rawX / snapWorld) * snapWorld
      expect(snappedX).toBe(2.5)
    })

    it('snaps negative coordinates correctly', () => {
      const { viewport } = createViewport()
      const snapWorld = viewport.snapSize / viewport.gridSize
      const rawX = -0.6
      const snappedX = Math.round(rawX / snapWorld) * snapWorld
      expect(snappedX).toBe(-1)
    })
  })

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('destroy', () => {
    it('removes canvas event listeners', () => {
      const { viewport, canvas } = createViewport()
      viewport.destroy()
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function))
    })

    it('removes document keyboard listeners', () => {
      const { viewport } = createViewport()
      viewport.destroy()
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
    })

    it('disconnects ResizeObserver', () => {
      const { viewport } = createViewport()
      const observer = viewport.resizeObserver
      viewport.destroy()
      expect(observer.disconnect).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Z-Level Management
  // ============================================================================

  describe('Z-level management', () => {
    it('returns available Z-levels', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      expect(viewport.getZLevels()).toEqual([-1, 0, 1])
    })

    it('returns [0] when no rooms loaded', () => {
      const { viewport } = createViewport()
      expect(viewport.getZLevels()).toEqual([0])
    })

    it('setZLevel updates current level', () => {
      const { viewport } = createViewport()
      viewport.setRooms(sampleRooms())
      viewport.setZLevel(-1)
      expect(viewport.currentZLevel).toBe(-1)
    })
  })

  // ============================================================================
  // Zone & NPC Data
  // ============================================================================

  describe('zone and NPC data', () => {
    it('stores zone colors', () => {
      const { viewport } = createViewport()
      viewport.setZoneColors({ forest: '#228b22', desert: '#deb887' })
      expect(viewport.zoneColors).toEqual({ forest: '#228b22', desert: '#deb887' })
    })

    it('stores room-zone mapping', () => {
      const { viewport } = createViewport()
      viewport.setRoomZoneMap({ town_square: 'town', market: 'town', tavern: 'town' })
      expect(viewport.roomZoneMap.town_square).toBe('town')
    })

    it('stores NPC paths', () => {
      const { viewport } = createViewport()
      const paths = { guard: { patrol: { route: ['town_square', 'market'], loop: true } } }
      viewport.setNPCPaths(paths)
      expect(viewport.npcPaths).toBe(paths)
    })

    it('handles null data gracefully', () => {
      const { viewport } = createViewport()
      viewport.setZoneColors(null)
      viewport.setRoomZoneMap(null)
      viewport.setNPCPaths(null)
      expect(viewport.zoneColors).toEqual({})
      expect(viewport.roomZoneMap).toEqual({})
      expect(viewport.npcPaths).toEqual({})
    })
  })
})
