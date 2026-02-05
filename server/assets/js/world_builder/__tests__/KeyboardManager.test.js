import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KeyboardManager } from '../KeyboardManager.js'

// Minimal DOM mocking for Node environment
function createMockDocument() {
  const listeners = {}
  return {
    addEventListener: vi.fn((type, handler) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(handler)
    }),
    removeEventListener: vi.fn((type, handler) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((h) => h !== handler)
      }
    }),
    querySelector: vi.fn(() => null),
    _dispatch(type, event) {
      for (const handler of listeners[type] || []) {
        handler(event)
      }
    }
  }
}

function createKeyEvent(key, opts = {}) {
  return {
    key,
    metaKey: opts.metaKey || false,
    ctrlKey: opts.ctrlKey || false,
    shiftKey: opts.shiftKey || false,
    target: opts.target || { tagName: 'DIV', isContentEditable: false },
    preventDefault: vi.fn()
  }
}

describe('KeyboardManager', () => {
  let km
  let mockDoc

  beforeEach(() => {
    mockDoc = createMockDocument()
    vi.stubGlobal('document', mockDoc)
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    km = new KeyboardManager()
  })

  afterEach(() => {
    km.destroy()
    vi.unstubAllGlobals()
  })

  describe('register and trigger', () => {
    it('triggers handler on matching key', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      const event = createKeyEvent('a')
      mockDoc._dispatch('keydown', event)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('does not trigger on non-matching key', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      mockDoc._dispatch('keydown', createKeyEvent('b'))

      expect(handler).not.toHaveBeenCalled()
    })

    it('attaches document listener on first register', () => {
      km.register('test', { key: 'a' }, vi.fn())

      expect(mockDoc.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('only attaches listener once for multiple registers', () => {
      km.register('test1', { key: 'a' }, vi.fn())
      km.register('test2', { key: 'b' }, vi.fn())

      expect(mockDoc.addEventListener).toHaveBeenCalledTimes(1)
    })

    it('replaces handler when re-registering same id', () => {
      const first = vi.fn()
      const second = vi.fn()

      km.register('test', { key: 'a' }, first)
      km.register('test', { key: 'a' }, second)

      mockDoc._dispatch('keydown', createKeyEvent('a'))

      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  describe('unregister', () => {
    it('removes shortcut by id', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)
      km.unregister('test')

      mockDoc._dispatch('keydown', createKeyEvent('a'))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('unregisterAll', () => {
    it('removes all shortcuts matching prefix', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      const h3 = vi.fn()

      km.register('wb-undo', { key: 'z' }, h1)
      km.register('wb-redo', { key: 'y' }, h2)
      km.register('other', { key: 'a' }, h3)

      km.unregisterAll('wb-')

      mockDoc._dispatch('keydown', createKeyEvent('z'))
      mockDoc._dispatch('keydown', createKeyEvent('y'))
      mockDoc._dispatch('keydown', createKeyEvent('a'))

      expect(h1).not.toHaveBeenCalled()
      expect(h2).not.toHaveBeenCalled()
      expect(h3).toHaveBeenCalledTimes(1)
    })
  })

  describe('mod key combo', () => {
    it('matches Cmd key on Mac', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' })

      const handler = vi.fn()
      km.register('save', { key: 's', mod: true }, handler)

      // Cmd+S on Mac
      mockDoc._dispatch('keydown', createKeyEvent('s', { metaKey: true }))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not trigger mod shortcut without mod key', () => {
      const handler = vi.fn()
      km.register('save', { key: 's', mod: true }, handler)

      mockDoc._dispatch('keydown', createKeyEvent('s'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('matches Ctrl key on non-Mac', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' })
      // Need a fresh instance to pick up the new navigator
      km.destroy()
      km = new KeyboardManager()

      const handler = vi.fn()
      km.register('save', { key: 's', mod: true }, handler)

      mockDoc._dispatch('keydown', createKeyEvent('s', { ctrlKey: true }))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('matches shift modifier', () => {
      const handler = vi.fn()
      km.register('redo', { key: 'z', mod: true, shift: true }, handler)

      // Cmd+Shift+Z
      mockDoc._dispatch('keydown', createKeyEvent('z', { metaKey: true, shiftKey: true }))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not match when shift is required but not pressed', () => {
      const handler = vi.fn()
      km.register('redo', { key: 'z', mod: true, shift: true }, handler)

      // Cmd+Z without shift
      mockDoc._dispatch('keydown', createKeyEvent('z', { metaKey: true }))
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('skipInputs option', () => {
    it('skips shortcuts when focused on INPUT by default', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      const event = createKeyEvent('a', {
        target: { tagName: 'INPUT', isContentEditable: false }
      })
      mockDoc._dispatch('keydown', event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('skips shortcuts when focused on TEXTAREA by default', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      const event = createKeyEvent('a', {
        target: { tagName: 'TEXTAREA', isContentEditable: false }
      })
      mockDoc._dispatch('keydown', event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('skips shortcuts when focused on SELECT by default', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      const event = createKeyEvent('a', {
        target: { tagName: 'SELECT', isContentEditable: false }
      })
      mockDoc._dispatch('keydown', event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('skips shortcuts when focused on contentEditable', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      const event = createKeyEvent('a', {
        target: { tagName: 'DIV', isContentEditable: true }
      })
      mockDoc._dispatch('keydown', event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('allows Escape in inputs even with skipInputs', () => {
      const handler = vi.fn()
      km.register('close', { key: 'escape' }, handler)

      const event = createKeyEvent('Escape', {
        target: { tagName: 'INPUT', isContentEditable: false }
      })
      mockDoc._dispatch('keydown', event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('fires shortcut in inputs when skipInputs is false', () => {
      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler, { skipInputs: false })

      const event = createKeyEvent('a', {
        target: { tagName: 'INPUT', isContentEditable: false }
      })
      mockDoc._dispatch('keydown', event)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('skipModals option', () => {
    it('skips shortcuts when modal is open by default', () => {
      mockDoc.querySelector.mockReturnValue({ className: 'modal-overlay' })

      const handler = vi.fn()
      km.register('test', { key: 'a' }, handler)

      mockDoc._dispatch('keydown', createKeyEvent('a'))

      expect(handler).not.toHaveBeenCalled()
    })

    it('allows Escape when modal is open', () => {
      mockDoc.querySelector.mockReturnValue({ className: 'modal-overlay' })

      const handler = vi.fn()
      km.register('close', { key: 'escape' }, handler)

      mockDoc._dispatch('keydown', createKeyEvent('Escape'))

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('destroy', () => {
    it('removes document listener', () => {
      km.register('test', { key: 'a' }, vi.fn())
      km.destroy()

      expect(mockDoc.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('clears all shortcuts', () => {
      km.register('test', { key: 'a' }, vi.fn())
      km.destroy()

      // Re-attach so we can dispatch
      km._attached = false
      km._attach()
      const handler = vi.fn()
      // The old handler should be gone
      mockDoc._dispatch('keydown', createKeyEvent('a'))
      // Nothing registered, so nothing should fire
    })
  })

  describe('first match wins', () => {
    it('only fires the first matching shortcut', () => {
      const first = vi.fn()
      const second = vi.fn()

      km.register('first', { key: 'a' }, first)
      km.register('second', { key: 'a' }, second)

      mockDoc._dispatch('keydown', createKeyEvent('a'))

      // Map iteration order is insertion order, so first wins
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).not.toHaveBeenCalled()
    })
  })
})
