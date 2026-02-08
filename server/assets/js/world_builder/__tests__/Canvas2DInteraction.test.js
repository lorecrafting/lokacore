import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Canvas2DInteraction } from '../Canvas2DInteraction.js'

// Mock canvas element
function createMockCanvas() {
  const listeners = {}
  return {
    addEventListener: vi.fn((type, handler, _opts) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(handler)
    }),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600, left: 0, top: 0 })),
    parentElement: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    style: {},
    _listeners: listeners,
  }
}

// Mock viewport
function createMockViewport() {
  return {
    getRoomAtPoint: vi.fn(() => null),
    screenToWorld: vi.fn((x, y) => ({ x: x / 60, y: y / 60 })),
    render: vi.fn(),
    markDirty: vi.fn(),
    setupCanvas: vi.fn(),
    onSelectRoom: vi.fn(),
    onMoveRoom: vi.fn(),
    selectedKeys: new Set(),
    camera: { x: 0, y: 0, zoom: 1 },
    gridSize: 60,
    snapSize: 60,
    minZoom: 0.1,
    maxZoom: 5,
    renderer: {
      clearTruncateCache: vi.fn(),
    },
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
      style: { cssText: '', display: 'none', left: '', top: '' },
      innerHTML: '',
      parentElement: { removeChild: vi.fn() },
      getBoundingClientRect: vi.fn(() => ({ width: 200, height: 100 })),
    })),
    _listeners: docListeners,
  })

  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function () {
      this.observe = vi.fn()
      this.disconnect = vi.fn()
    })
  )
}

describe('Canvas2DInteraction', () => {
  let interaction
  let canvas
  let viewport

  beforeEach(() => {
    setupGlobals()
    canvas = createMockCanvas()
    viewport = createMockViewport()
    interaction = new Canvas2DInteraction(canvas, viewport)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constructor', () => {
    it('initializes with canvas and viewport references', () => {
      expect(interaction.canvas).toBe(canvas)
      expect(interaction.viewport).toBe(viewport)
    })

    it('initializes drag state to false', () => {
      expect(interaction.isDragging).toBe(false)
      expect(interaction.isDraggingRoom).toBe(false)
      expect(interaction.draggedRoom).toBeNull()
    })

    it('initializes snapping state', () => {
      expect(interaction.isSnapping).toBe(false)
      expect(interaction.snapIndicator).toBeNull()
    })

    it('initializes hover state', () => {
      expect(interaction.hoveredRoom).toBeNull()
    })
  })

  describe('attach', () => {
    it('adds mouse event listeners to canvas', () => {
      interaction.attach()

      expect(canvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
        passive: false,
      })
      expect(canvas.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function))
    })

    it('creates a ResizeObserver', () => {
      interaction.attach()
      expect(ResizeObserver).toHaveBeenCalled()
      expect(interaction.resizeObserver).toBeDefined()
    })

    it('adds keyboard event listeners to document', () => {
      interaction.attach()
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(document.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
    })

    it('creates tooltip element', () => {
      interaction.attach()
      expect(document.createElement).toHaveBeenCalledWith('div')
      expect(interaction.tooltip).toBeDefined()
      expect(canvas.parentElement.appendChild).toHaveBeenCalled()
    })
  })

  describe('detach', () => {
    beforeEach(() => {
      interaction.attach()
    })

    it('removes canvas event listeners', () => {
      interaction.detach()
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function))
    })

    it('disconnects resize observer', () => {
      const mockDisconnect = interaction.resizeObserver.disconnect
      interaction.detach()
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('removes document keyboard listeners', () => {
      interaction.detach()
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
    })
  })

  describe('handleKeyDown', () => {
    it('sets isSnapping to true on Shift key', () => {
      interaction.handleKeyDown({ key: 'Shift' })
      expect(interaction.isSnapping).toBe(true)
    })

    it('calls render when shift pressed during room drag', () => {
      interaction.isDraggingRoom = true
      interaction.handleKeyDown({ key: 'Shift' })
      expect(viewport.render).toHaveBeenCalled()
    })

    it('does not set isSnapping for other keys', () => {
      interaction.handleKeyDown({ key: 'a' })
      expect(interaction.isSnapping).toBe(false)
    })
  })

  describe('handleKeyUp', () => {
    beforeEach(() => {
      interaction.isSnapping = true
    })

    it('sets isSnapping to false on Shift release', () => {
      interaction.handleKeyUp({ key: 'Shift' })
      expect(interaction.isSnapping).toBe(false)
    })

    it('clears snap indicator on Shift release', () => {
      interaction.snapIndicator = { x: 1, y: 1 }
      interaction.handleKeyUp({ key: 'Shift' })
      expect(interaction.snapIndicator).toBeNull()
    })

    it('calls render when shift released during room drag', () => {
      interaction.isDraggingRoom = true
      interaction.handleKeyUp({ key: 'Shift' })
      expect(viewport.render).toHaveBeenCalled()
    })
  })

  describe('handleMouseDown', () => {
    const createMouseEvent = (x, y) => ({
      clientX: x,
      clientY: y,
    })

    it('starts panning when clicking empty space', () => {
      viewport.getRoomAtPoint.mockReturnValue(null)

      interaction.handleMouseDown(createMouseEvent(100, 100))

      expect(interaction.isDragging).toBe(true)
      expect(interaction.isDraggingRoom).toBe(false)
      expect(canvas.style.cursor).toBe('grabbing')
    })

    it('starts room dragging when clicking a room', () => {
      const room = { key: 'test_room', x: 0, y: 0 }
      viewport.getRoomAtPoint.mockReturnValue(room)

      interaction.handleMouseDown(createMouseEvent(100, 100))

      expect(interaction.isDragging).toBe(true)
      expect(interaction.isDraggingRoom).toBe(true)
      expect(interaction.draggedRoom).toBe(room)
      expect(canvas.style.cursor).toBe('move')
    })

    it('selects room when clicking unselected room', () => {
      const room = { key: 'test_room', x: 0, y: 0 }
      viewport.getRoomAtPoint.mockReturnValue(room)

      interaction.handleMouseDown(createMouseEvent(100, 100))

      expect(viewport.onSelectRoom).toHaveBeenCalledWith('test_room', false)
    })

    it('does not re-select already selected room', () => {
      const room = { key: 'test_room', x: 0, y: 0 }
      viewport.getRoomAtPoint.mockReturnValue(room)
      viewport.selectedKeys.add('test_room')

      interaction.handleMouseDown(createMouseEvent(100, 100))

      expect(viewport.onSelectRoom).not.toHaveBeenCalled()
    })

    it('stores drag start position', () => {
      interaction.handleMouseDown(createMouseEvent(150, 200))

      expect(interaction.dragStart).toEqual({ x: 150, y: 200 })
      expect(interaction.lastMousePos).toEqual({ x: 150, y: 200 })
    })

    it('stores original room position for potential restore', () => {
      const room = { key: 'test_room', x: 5, y: 10 }
      viewport.getRoomAtPoint.mockReturnValue(room)

      interaction.handleMouseDown(createMouseEvent(100, 100))

      expect(interaction.dragRoomStartPos).toEqual({ x: 5, y: 10 })
    })
  })

  describe('handleMouseMove', () => {
    const createMouseEvent = (x, y, shiftKey = false) => ({
      clientX: x,
      clientY: y,
      shiftKey,
    })

    describe('when panning', () => {
      beforeEach(() => {
        viewport.getRoomAtPoint.mockReturnValue(null)
        interaction.handleMouseDown(createMouseEvent(100, 100))
      })

      it('updates camera position based on delta', () => {
        interaction.handleMouseMove(createMouseEvent(120, 130))

        // Delta is (20, 30) / zoom(1)
        expect(viewport.camera.x).toBe(20)
        expect(viewport.camera.y).toBe(30)
        expect(viewport.render).toHaveBeenCalled()
      })

      it('scales pan by zoom level', () => {
        viewport.camera.zoom = 2
        interaction.handleMouseMove(createMouseEvent(120, 130))

        // Delta is (20, 30) / zoom(2) = (10, 15)
        expect(viewport.camera.x).toBe(10)
        expect(viewport.camera.y).toBe(15)
      })
    })

    describe('when dragging room', () => {
      let room

      beforeEach(() => {
        room = { key: 'test_room', x: 0, y: 0, name: 'Test Room' }
        viewport.getRoomAtPoint.mockReturnValue(room)
        viewport.selectedKeys.add('test_room')
        interaction.handleMouseDown(createMouseEvent(100, 100))
        viewport.render.mockClear()
      })

      it('updates room position from world coordinates', () => {
        viewport.screenToWorld.mockReturnValue({ x: 2, y: 3 })
        interaction.handleMouseMove(createMouseEvent(200, 200))

        expect(room.x).toBe(2)
        expect(room.y).toBe(3)
        expect(viewport.render).toHaveBeenCalled()
      })

      it('applies grid snapping when shift is held', () => {
        viewport.screenToWorld.mockReturnValue({ x: 1.7, y: 2.3 })
        interaction.handleMouseMove(createMouseEvent(200, 200, true))

        // With snapSize/gridSize = 1, snaps to nearest integer
        expect(room.x).toBe(2)
        expect(room.y).toBe(2)
        expect(interaction.snapIndicator).toEqual({ x: 2, y: 2 })
      })

      it('clears snap indicator when shift is not held', () => {
        interaction.snapIndicator = { x: 1, y: 1 }
        viewport.screenToWorld.mockReturnValue({ x: 1.7, y: 2.3 })
        interaction.handleMouseMove(createMouseEvent(200, 200, false))

        expect(interaction.snapIndicator).toBeNull()
      })
    })

    describe('when not dragging (hover)', () => {
      beforeEach(() => {
        interaction.attach() // Creates tooltip
      })

      it('sets cursor to pointer when hovering room', () => {
        const room = { key: 'test_room', x: 0, y: 0, name: 'Test Room' }
        viewport.getRoomAtPoint.mockReturnValue(room)

        interaction.handleMouseMove(createMouseEvent(100, 100))

        expect(canvas.style.cursor).toBe('pointer')
      })

      it('sets cursor to grab when not hovering room', () => {
        viewport.getRoomAtPoint.mockReturnValue(null)

        interaction.handleMouseMove(createMouseEvent(100, 100))

        expect(canvas.style.cursor).toBe('grab')
      })

      it('updates hoveredRoom when entering a room', () => {
        const room = { key: 'test_room', x: 0, y: 0, name: 'Test Room' }
        viewport.getRoomAtPoint.mockReturnValue(room)

        interaction.handleMouseMove(createMouseEvent(100, 100))

        expect(interaction.hoveredRoom).toBe(room)
      })

      it('clears hoveredRoom when leaving a room', () => {
        interaction.hoveredRoom = { key: 'old_room' }
        viewport.getRoomAtPoint.mockReturnValue(null)

        interaction.handleMouseMove(createMouseEvent(100, 100))

        expect(interaction.hoveredRoom).toBeNull()
      })
    })
  })

  describe('handleMouseUp', () => {
    it('calls onMoveRoom when room position changed', () => {
      const room = { key: 'test_room', x: 0, y: 0 }
      viewport.getRoomAtPoint.mockReturnValue(room)
      viewport.selectedKeys.add('test_room')

      interaction.handleMouseDown({ clientX: 100, clientY: 100 })

      // Simulate position change
      room.x = 5
      room.y = 10

      interaction.handleMouseUp({})

      expect(viewport.onMoveRoom).toHaveBeenCalledWith('test_room', 5, 10)
    })

    it('does not call onMoveRoom when position unchanged', () => {
      const room = { key: 'test_room', x: 5, y: 10 }
      viewport.getRoomAtPoint.mockReturnValue(room)
      viewport.selectedKeys.add('test_room')

      interaction.handleMouseDown({ clientX: 100, clientY: 100 })
      // Don't change position
      interaction.handleMouseUp({})

      expect(viewport.onMoveRoom).not.toHaveBeenCalled()
    })

    it('resets drag state', () => {
      const room = { key: 'test_room', x: 0, y: 0 }
      viewport.getRoomAtPoint.mockReturnValue(room)

      interaction.handleMouseDown({ clientX: 100, clientY: 100 })
      interaction.handleMouseUp({})

      expect(interaction.isDragging).toBe(false)
      expect(interaction.isDraggingRoom).toBe(false)
      expect(interaction.draggedRoom).toBeNull()
      expect(interaction.snapIndicator).toBeNull()
    })

    it('restores cursor to grab', () => {
      interaction.handleMouseDown({ clientX: 100, clientY: 100 })
      interaction.handleMouseUp({})

      expect(canvas.style.cursor).toBe('grab')
    })
  })

  describe('handleMouseLeave', () => {
    it('clears hovered room', () => {
      interaction.hoveredRoom = { key: 'test' }
      interaction.handleMouseLeave({})
      expect(interaction.hoveredRoom).toBeNull()
    })

    it('restores room position when dragging room and leaving canvas', () => {
      const room = { key: 'test_room', x: 5, y: 10 }
      viewport.getRoomAtPoint.mockReturnValue(room)
      viewport.selectedKeys.add('test_room')

      interaction.handleMouseDown({ clientX: 100, clientY: 100 })

      // Room was moved
      room.x = 20
      room.y = 30

      interaction.handleMouseLeave({})

      // Position should be restored
      expect(room.x).toBe(5)
      expect(room.y).toBe(10)
    })

    it('resets drag state on leave', () => {
      interaction.isDragging = true
      interaction.isDraggingRoom = true
      interaction.handleMouseLeave({})

      expect(interaction.isDragging).toBe(false)
    })
  })

  describe('handleWheel', () => {
    const createWheelEvent = (deltaY, clientX = 400, clientY = 300) => ({
      deltaY,
      clientX,
      clientY,
      preventDefault: vi.fn(),
    })

    it('prevents default scroll behavior', () => {
      const event = createWheelEvent(100)
      interaction.handleWheel(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('zooms out when scrolling down (positive deltaY)', () => {
      viewport.camera.zoom = 1
      interaction.handleWheel(createWheelEvent(100))
      expect(viewport.camera.zoom).toBeCloseTo(0.9)
    })

    it('zooms in when scrolling up (negative deltaY)', () => {
      viewport.camera.zoom = 1
      interaction.handleWheel(createWheelEvent(-100))
      expect(viewport.camera.zoom).toBeCloseTo(1.1)
    })

    it('respects minZoom limit', () => {
      viewport.camera.zoom = 0.15
      viewport.minZoom = 0.1
      interaction.handleWheel(createWheelEvent(100)) // Zoom out
      expect(viewport.camera.zoom).toBeGreaterThanOrEqual(0.1)
    })

    it('respects maxZoom limit', () => {
      viewport.camera.zoom = 4.5
      viewport.maxZoom = 5
      interaction.handleWheel(createWheelEvent(-100)) // Zoom in
      expect(viewport.camera.zoom).toBeLessThanOrEqual(5)
    })

    it('clears truncation cache when zoom changes', () => {
      viewport.camera.zoom = 1
      interaction.handleWheel(createWheelEvent(-100))
      expect(viewport.renderer.clearTruncateCache).toHaveBeenCalled()
    })

    it('calls render after zoom', () => {
      interaction.handleWheel(createWheelEvent(-100))
      expect(viewport.render).toHaveBeenCalled()
    })
  })

  describe('tooltip', () => {
    beforeEach(() => {
      interaction.attach()
    })

    describe('showTooltip', () => {
      it('displays tooltip for room', () => {
        const room = {
          key: 'test_room',
          name: 'Test Room',
          x: 5,
          y: 10,
          z: 0,
          exits: { north: 'other_room' },
          spawns: { npcs: ['merchant'], items: ['sword'] },
        }

        interaction.showTooltip(room, 100, 100)

        expect(interaction.tooltip.style.display).toBe('block')
        expect(interaction.tooltip.innerHTML).toContain('Test Room')
        expect(interaction.tooltip.innerHTML).toContain('test_room')
      })

      it('does nothing if tooltip or room is null', () => {
        interaction.showTooltip(null, 100, 100)
        expect(interaction.tooltip.style.display).toBe('none')
      })
    })

    describe('hideTooltip', () => {
      it('hides the tooltip', () => {
        interaction.tooltip.style.display = 'block'
        interaction.hideTooltip()
        expect(interaction.tooltip.style.display).toBe('none')
      })
    })

    describe('destroyTooltip', () => {
      it('removes tooltip from DOM', () => {
        const mockRemoveChild = vi.fn()
        interaction.tooltip.parentElement = { removeChild: mockRemoveChild }

        interaction.destroyTooltip()

        expect(mockRemoveChild).toHaveBeenCalled()
        expect(interaction.tooltip).toBeNull()
      })
    })
  })
})
