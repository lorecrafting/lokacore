/**
 * KeyboardManager - Centralized keyboard shortcut handling.
 *
 * Provides a single document-level keydown listener with a registration API.
 * Prevents duplicate handler bugs (e.g., two modules both handling Ctrl+Z).
 *
 * Usage:
 *   import { keyboardManager } from '../world_builder/KeyboardManager.js'
 *
 *   // In hook mounted():
 *   keyboardManager.register('undo', { key: 'z', mod: true }, () => undoManager.undo())
 *   keyboardManager.register('redo', { key: 'z', mod: true, shift: true }, () => undoManager.redo())
 *   keyboardManager.register('save', { key: 's', mod: true }, () => this.pushEvent('validate_all', {}))
 *
 *   // In hook destroyed():
 *   keyboardManager.unregister('undo')
 *   keyboardManager.unregister('redo')
 *   keyboardManager.unregister('save')
 *
 * Options:
 *   key   - Key name (lowercase, e.g. 'z', 's', 'escape', '1', '/')
 *   mod   - Cross-platform modifier (Cmd on Mac, Ctrl on others). Default: undefined (don't check)
 *   shift - Require shift. Default: undefined (don't check)
 *   skipInputs - Skip when focus is in INPUT/TEXTAREA/SELECT. Default: true
 *   skipModals - Skip when a .modal-overlay is visible. Default: true (except Escape)
 */
class KeyboardManager {
  constructor() {
    this._shortcuts = new Map()
    this._handler = this._dispatch.bind(this)
    this._attached = false
  }

  /**
   * Attach the document listener. Called automatically on first register().
   */
  _attach() {
    if (!this._attached) {
      document.addEventListener('keydown', this._handler)
      this._attached = true
    }
  }

  /**
   * Register a named keyboard shortcut. Only one handler per ID.
   * Re-registering the same ID replaces the previous handler.
   */
  register(id, combo, handler, options = {}) {
    this._attach()
    this._shortcuts.set(id, {
      key: combo.key.toLowerCase(),
      mod: combo.mod,
      shift: combo.shift,
      handler,
      skipInputs: options.skipInputs !== false,
      skipModals: options.skipModals !== false,
    })
  }

  /**
   * Unregister a shortcut by ID.
   */
  unregister(id) {
    this._shortcuts.delete(id)
  }

  /**
   * Unregister all shortcuts with IDs matching a prefix.
   * Useful for cleanup: keyboardManager.unregisterAll('wb-')
   */
  unregisterAll(prefix) {
    for (const id of this._shortcuts.keys()) {
      if (id.startsWith(prefix)) {
        this._shortcuts.delete(id)
      }
    }
  }

  /**
   * Internal dispatcher. Iterates registered shortcuts, first match wins.
   */
  _dispatch(e) {
    const target = e.target
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable

    const isMac = navigator.userAgentData?.platform === 'macOS'
      || navigator.platform?.toUpperCase().includes('MAC')
      || false
    const modKey = isMac ? e.metaKey : e.ctrlKey
    const modalOpen = !!document.querySelector('.modal-overlay')
    const pressedKey = e.key.toLowerCase()

    for (const [, shortcut] of this._shortcuts) {
      // Skip if typing in input and shortcut requires skipping inputs
      if (shortcut.skipInputs && isInput) {
        // Always allow Escape in inputs (for blur)
        if (pressedKey !== 'escape') continue
      }

      // Skip if modal open (except Escape for closing)
      if (shortcut.skipModals && modalOpen && pressedKey !== 'escape') continue

      // Match key
      if (shortcut.key !== pressedKey) continue

      // Match mod key (Cmd/Ctrl)
      if (shortcut.mod !== undefined && shortcut.mod !== modKey) continue

      // Match shift
      if (shortcut.shift !== undefined && shortcut.shift !== e.shiftKey) continue

      e.preventDefault()
      shortcut.handler(e)
      return // First match wins
    }
  }

  /**
   * Remove document listener and clear all shortcuts.
   */
  destroy() {
    if (this._attached) {
      document.removeEventListener('keydown', this._handler)
      this._attached = false
    }
    this._shortcuts.clear()
  }
}

// Singleton - one global keyboard handler for the entire app
export const keyboardManager = new KeyboardManager()
export default keyboardManager
