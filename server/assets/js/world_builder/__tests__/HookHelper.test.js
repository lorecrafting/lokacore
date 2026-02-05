import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HookHelper } from '../HookHelper.js'

function createMockTarget() {
  return { addEventListener: vi.fn(), removeEventListener: vi.fn() }
}

function createMockObserver() {
  return { observe: vi.fn(), disconnect: vi.fn() }
}

describe('HookHelper', () => {
  let helper
  let mockHook

  beforeEach(() => {
    vi.useFakeTimers()
    mockHook = { el: {} }
    helper = new HookHelper(mockHook)
  })

  describe('constructor', () => {
    it('stores the hook reference', () => {
      expect(helper.hook).toBe(mockHook)
    })

    it('initializes empty tracking arrays', () => {
      expect(helper._listeners).toEqual([])
      expect(helper._observers).toEqual([])
      expect(helper._intervals).toEqual([])
    })
  })

  describe('on()', () => {
    it('adds an event listener to the target', () => {
      const target = createMockTarget()
      const handler = vi.fn()

      helper.on(target, 'click', handler)

      expect(target.addEventListener).toHaveBeenCalledWith('click', handler, undefined)
    })

    it('tracks the listener for cleanup', () => {
      const target = createMockTarget()
      const handler = vi.fn()

      helper.on(target, 'click', handler)

      expect(helper._listeners).toHaveLength(1)
      expect(helper._listeners[0]).toEqual({
        target,
        event: 'click',
        handler,
        options: undefined,
      })
    })

    it('passes options to addEventListener', () => {
      const target = createMockTarget()
      const handler = vi.fn()
      const options = { capture: true }

      helper.on(target, 'keydown', handler, options)

      expect(target.addEventListener).toHaveBeenCalledWith('keydown', handler, options)
      expect(helper._listeners[0].options).toEqual({ capture: true })
    })

    it('supports multiple listeners on different targets', () => {
      const target1 = createMockTarget()
      const target2 = createMockTarget()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      helper.on(target1, 'click', handler1)
      helper.on(target2, 'resize', handler2)

      expect(helper._listeners).toHaveLength(2)
      expect(target1.addEventListener).toHaveBeenCalledTimes(1)
      expect(target2.addEventListener).toHaveBeenCalledTimes(1)
    })

    it('supports multiple listeners on the same target', () => {
      const target = createMockTarget()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      helper.on(target, 'click', handler1)
      helper.on(target, 'keydown', handler2)

      expect(helper._listeners).toHaveLength(2)
      expect(target.addEventListener).toHaveBeenCalledTimes(2)
    })
  })

  describe('observe()', () => {
    it('calls observe on the observer with the element', () => {
      const observer = createMockObserver()
      const el = {}

      helper.observe(observer, el)

      expect(observer.observe).toHaveBeenCalledWith(el)
    })

    it('tracks the observer for cleanup', () => {
      const observer = createMockObserver()

      helper.observe(observer, {})

      expect(helper._observers).toHaveLength(1)
      expect(helper._observers[0]).toBe(observer)
    })

    it('only tracks each observer once even if used on multiple elements', () => {
      const observer = createMockObserver()
      const el1 = {}
      const el2 = {}

      helper.observe(observer, el1)
      helper.observe(observer, el2)

      expect(helper._observers).toHaveLength(1)
      expect(observer.observe).toHaveBeenCalledTimes(2)
    })

    it('tracks different observers separately', () => {
      const observer1 = createMockObserver()
      const observer2 = createMockObserver()

      helper.observe(observer1, {})
      helper.observe(observer2, {})

      expect(helper._observers).toHaveLength(2)
    })
  })

  describe('interval()', () => {
    it('creates a setInterval and returns the ID', () => {
      const fn = vi.fn()
      const id = helper.interval(fn, 1000)

      expect(id).toBeDefined()
    })

    it('tracks the interval ID for cleanup', () => {
      const fn = vi.fn()
      helper.interval(fn, 1000)

      expect(helper._intervals).toHaveLength(1)
    })

    it('executes the callback on the given interval', () => {
      const fn = vi.fn()
      helper.interval(fn, 500)

      vi.advanceTimersByTime(1500)

      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('supports multiple intervals', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()

      helper.interval(fn1, 100)
      helper.interval(fn2, 200)

      expect(helper._intervals).toHaveLength(2)
    })
  })

  describe('destroy()', () => {
    it('removes all event listeners', () => {
      const target1 = createMockTarget()
      const target2 = createMockTarget()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const options = { capture: true }

      helper.on(target1, 'click', handler1)
      helper.on(target2, 'keydown', handler2, options)

      helper.destroy()

      expect(target1.removeEventListener).toHaveBeenCalledWith('click', handler1, undefined)
      expect(target2.removeEventListener).toHaveBeenCalledWith('keydown', handler2, options)
      expect(helper._listeners).toEqual([])
    })

    it('disconnects all observers', () => {
      const observer1 = createMockObserver()
      const observer2 = createMockObserver()

      helper.observe(observer1, {})
      helper.observe(observer2, {})

      helper.destroy()

      expect(observer1.disconnect).toHaveBeenCalledTimes(1)
      expect(observer2.disconnect).toHaveBeenCalledTimes(1)
      expect(helper._observers).toEqual([])
    })

    it('clears all intervals', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()

      helper.interval(fn1, 100)
      helper.interval(fn2, 200)

      helper.destroy()

      // Advance time - callbacks should not fire after destroy
      vi.advanceTimersByTime(1000)

      expect(fn1).not.toHaveBeenCalled()
      expect(fn2).not.toHaveBeenCalled()
      expect(helper._intervals).toEqual([])
    })

    it('handles everything together', () => {
      const target = createMockTarget()
      const handler = vi.fn()
      const observer = createMockObserver()
      const intervalFn = vi.fn()

      helper.on(target, 'click', handler)
      helper.observe(observer, {})
      helper.interval(intervalFn, 100)

      helper.destroy()

      expect(target.removeEventListener).toHaveBeenCalled()
      expect(observer.disconnect).toHaveBeenCalled()
      expect(helper._listeners).toEqual([])
      expect(helper._observers).toEqual([])
      expect(helper._intervals).toEqual([])
    })

    it('is safe to call multiple times', () => {
      const target = createMockTarget()
      const observer = createMockObserver()

      helper.on(target, 'click', vi.fn())
      helper.observe(observer, {})
      helper.interval(vi.fn(), 100)

      helper.destroy()
      helper.destroy()

      // Should not throw, and arrays should remain empty
      expect(helper._listeners).toEqual([])
      expect(helper._observers).toEqual([])
      expect(helper._intervals).toEqual([])
    })

    it('allows new registrations after destroy', () => {
      const target = createMockTarget()
      helper.on(target, 'click', vi.fn())
      helper.destroy()

      // Re-register after destroy
      const newTarget = createMockTarget()
      const newHandler = vi.fn()
      helper.on(newTarget, 'resize', newHandler)

      expect(helper._listeners).toHaveLength(1)
      expect(newTarget.addEventListener).toHaveBeenCalledWith('resize', newHandler, undefined)
    })
  })
})
