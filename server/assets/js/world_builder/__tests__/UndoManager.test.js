import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UndoManager } from '../UndoManager.js'

// Mock sessionStorage for Node environment
const mockStorage = {}
global.sessionStorage = {
  getItem: vi.fn((key) => mockStorage[key] || null),
  setItem: vi.fn((key, value) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key) => {
    delete mockStorage[key]
  }),
}

describe('UndoManager', () => {
  let manager

  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockStorage)) delete mockStorage[key]
    manager = new UndoManager()
    manager.setPushEvent(vi.fn())
  })

  describe('record', () => {
    it('adds operation to undo stack', () => {
      manager.record('update_room', { name: 'old' }, { name: 'new' })

      expect(manager.undoStack).toHaveLength(1)
      expect(manager.undoStack[0].type).toBe('update_room')
      expect(manager.undoStack[0].beforeState).toEqual({ name: 'old' })
      expect(manager.undoStack[0].afterState).toEqual({ name: 'new' })
    })

    it('stores metadata', () => {
      manager.record('update_room', {}, {}, { key: 'room_1' })

      expect(manager.undoStack[0].metadata).toEqual({ key: 'room_1' })
    })

    it('adds timestamp', () => {
      manager.record('update_room', {}, {})

      expect(manager.undoStack[0].timestamp).toBeTypeOf('number')
    })

    it('clears redo stack on new record', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.undo()
      expect(manager.redoStack).toHaveLength(1)

      manager.record('create_room', {}, { v: 3 })
      expect(manager.redoStack).toHaveLength(0)
    })
  })

  describe('undo', () => {
    it('returns false when stack is empty', () => {
      expect(manager.undo()).toBe(false)
    })

    it('moves operation from undo to redo stack', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.undo()

      expect(manager.undoStack).toHaveLength(0)
      expect(manager.redoStack).toHaveLength(1)
    })

    it('calls pushEvent with beforeState', () => {
      const pushEvent = vi.fn()
      manager.setPushEvent(pushEvent)

      manager.record('update_room', { v: 1 }, { v: 2 }, { key: 'r1' })
      manager.undo()

      expect(pushEvent).toHaveBeenCalledWith('undo_operation', {
        type: 'update_room',
        state: { v: 1 },
        metadata: { key: 'r1' },
      })
    })

    it('returns true on success', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      expect(manager.undo()).toBe(true)
    })
  })

  describe('redo', () => {
    it('returns false when stack is empty', () => {
      expect(manager.redo()).toBe(false)
    })

    it('moves operation from redo to undo stack', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.undo()
      manager.redo()

      expect(manager.undoStack).toHaveLength(1)
      expect(manager.redoStack).toHaveLength(0)
    })

    it('calls pushEvent with afterState', () => {
      const pushEvent = vi.fn()
      manager.setPushEvent(pushEvent)

      manager.record('update_room', { v: 1 }, { v: 2 }, { key: 'r1' })
      manager.undo()
      pushEvent.mockClear()
      manager.redo()

      expect(pushEvent).toHaveBeenCalledWith('redo_operation', {
        type: 'update_room',
        state: { v: 2 },
        metadata: { key: 'r1' },
      })
    })

    it('returns true on success', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.undo()
      expect(manager.redo()).toBe(true)
    })
  })

  describe('stack limit', () => {
    it('enforces max 50 operations', () => {
      for (let i = 0; i < 60; i++) {
        manager.record('update_room', { v: i }, { v: i + 1 })
      }

      expect(manager.undoStack).toHaveLength(50)
    })

    it('removes oldest operations first', () => {
      for (let i = 0; i < 55; i++) {
        manager.record('update_room', { v: i }, { v: i + 1 })
      }

      // First operation should be index 5 (0-4 were shifted off)
      expect(manager.undoStack[0].beforeState).toEqual({ v: 5 })
    })
  })

  describe('composite operations', () => {
    it('batches operations between begin and end', () => {
      manager.beginComposite('move rooms')
      manager.record('update_room', { x: 0 }, { x: 1 })
      manager.record('update_room', { x: 1 }, { x: 2 })
      manager.endComposite()

      expect(manager.undoStack).toHaveLength(1)
      expect(manager.undoStack[0].type).toBe('composite')
      expect(manager.undoStack[0].operations).toHaveLength(2)
      expect(manager.undoStack[0].label).toBe('move rooms')
    })

    it('does not add to undo stack during composing', () => {
      manager.beginComposite()
      manager.record('update_room', { x: 0 }, { x: 1 })

      expect(manager.undoStack).toHaveLength(0)
    })

    it('undoes composite operations in reverse order', () => {
      const pushEvent = vi.fn()
      manager.setPushEvent(pushEvent)

      manager.beginComposite()
      manager.record('update_room', { v: 'a' }, { v: 'b' }, { key: '1' })
      manager.record('update_room', { v: 'c' }, { v: 'd' }, { key: '2' })
      manager.endComposite()

      manager.undo()

      expect(pushEvent).toHaveBeenCalledTimes(2)
      // Second op undone first (reverse order)
      expect(pushEvent).toHaveBeenNthCalledWith(1, 'undo_operation', {
        type: 'update_room',
        state: { v: 'c' },
        metadata: { key: '2' },
      })
      expect(pushEvent).toHaveBeenNthCalledWith(2, 'undo_operation', {
        type: 'update_room',
        state: { v: 'a' },
        metadata: { key: '1' },
      })
    })

    it('redoes composite operations in forward order', () => {
      const pushEvent = vi.fn()
      manager.setPushEvent(pushEvent)

      manager.beginComposite()
      manager.record('update_room', { v: 'a' }, { v: 'b' }, { key: '1' })
      manager.record('update_room', { v: 'c' }, { v: 'd' }, { key: '2' })
      manager.endComposite()

      manager.undo()
      pushEvent.mockClear()
      manager.redo()

      expect(pushEvent).toHaveBeenCalledTimes(2)
      // First op redone first (forward order)
      expect(pushEvent).toHaveBeenNthCalledWith(1, 'redo_operation', {
        type: 'update_room',
        state: { v: 'b' },
        metadata: { key: '1' },
      })
      expect(pushEvent).toHaveBeenNthCalledWith(2, 'redo_operation', {
        type: 'update_room',
        state: { v: 'd' },
        metadata: { key: '2' },
      })
    })

    it('discards empty composite', () => {
      manager.beginComposite()
      manager.endComposite()

      expect(manager.undoStack).toHaveLength(0)
    })

    it('cancelComposite discards pending operations', () => {
      manager.beginComposite()
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.cancelComposite()

      expect(manager.undoStack).toHaveLength(0)
      expect(manager.isComposing).toBe(false)
    })
  })

  describe('getState', () => {
    it('returns correct state when empty', () => {
      const state = manager.getState()

      expect(state).toEqual({
        undoCount: 0,
        redoCount: 0,
        canUndo: false,
        canRedo: false,
        lastOperation: null,
      })
    })

    it('returns correct state after recording', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      const state = manager.getState()

      expect(state.undoCount).toBe(1)
      expect(state.redoCount).toBe(0)
      expect(state.canUndo).toBe(true)
      expect(state.canRedo).toBe(false)
      expect(state.lastOperation.type).toBe('update_room')
    })

    it('returns correct state after undo', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.undo()
      const state = manager.getState()

      expect(state.undoCount).toBe(0)
      expect(state.redoCount).toBe(1)
      expect(state.canUndo).toBe(false)
      expect(state.canRedo).toBe(true)
    })
  })

  describe('clear', () => {
    it('resets all stacks', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.record('update_room', { v: 2 }, { v: 3 })
      manager.undo()

      manager.clear()

      expect(manager.undoStack).toHaveLength(0)
      expect(manager.redoStack).toHaveLength(0)
      expect(manager.isComposing).toBe(false)
      expect(manager.compositeOperations).toHaveLength(0)
    })

    it('notifies state change', () => {
      const callback = vi.fn()
      manager.setOnStateChange(callback)

      manager.clear()

      expect(callback).toHaveBeenCalledWith(manager.getState())
    })
  })

  describe('onStateChange callback', () => {
    it('fires on record', () => {
      const callback = vi.fn()
      manager.setOnStateChange(callback)

      manager.record('update_room', { v: 1 }, { v: 2 })

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('fires on undo', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })

      const callback = vi.fn()
      manager.setOnStateChange(callback)
      manager.undo()

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('fires on redo', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })
      manager.undo()

      const callback = vi.fn()
      manager.setOnStateChange(callback)
      manager.redo()

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('session storage', () => {
    it('saves to sessionStorage on record', () => {
      manager.record('update_room', { v: 1 }, { v: 2 })

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'world_builder_undo_stack',
        expect.any(String)
      )
    })

    it('restores from sessionStorage on construction', () => {
      const data = JSON.stringify({
        undoStack: [{ type: 'update_room', beforeState: { v: 1 }, afterState: { v: 2 } }],
        redoStack: [],
      })
      mockStorage['world_builder_undo_stack'] = data

      const restored = new UndoManager()

      expect(restored.undoStack).toHaveLength(1)
      expect(restored.undoStack[0].type).toBe('update_room')
    })
  })
})
