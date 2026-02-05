/**
 * KeyboardManager - Centralized keyboard shortcut handling.
 *
 * Provides a single document-level keydown listener with a registration API.
 * Prevents duplicate handler bugs (e.g., two modules both handling Ctrl+Z).
 *
 * This is a singleton class - use the exported `keyboardManager` instance for app use,
 * or import the `KeyboardManager` class directly for testing purposes.
 *
 * @example
 * ```js
 * import { keyboardManager } from '../world_builder/KeyboardManager.js'
 *
 * // In hook mounted():
 * keyboardManager.register('undo', { key: 'z', mod: true }, () => undoManager.undo())
 * keyboardManager.register('redo', { key: 'z', mod: true, shift: true }, () => undoManager.redo())
 * keyboardManager.register('save', { key: 's', mod: true }, () => this.pushEvent('validate_all', {}))
 *
 * // In hook destroyed():
 * keyboardManager.unregister('undo')
 * keyboardManager.unregister('redo')
 * keyboardManager.unregister('save')
 * ```
 */

/**
 * Key combination for a keyboard shortcut.
 * @typedef {Object} ShortcutCombo
 * @property {string} key - Key name (lowercase, e.g. 'z', 's', 'escape', '1', '/')
 * @property {boolean} [mod] - Cross-platform modifier (Cmd on Mac, Ctrl on others). If undefined, modifier is not checked.
 * @property {boolean} [shift] - Require shift key. If undefined, shift is not checked.
 */

/**
 * Options for keyboard shortcut behavior.
 * @typedef {Object} ShortcutOptions
 * @property {boolean} [skipInputs=true] - Skip when focus is in INPUT/TEXTAREA/SELECT/contentEditable. Default: true.
 * @property {boolean} [skipModals=true] - Skip when a .modal-overlay is visible. Default: true (except Escape key).
 */

/**
 * Internal shortcut entry stored in the shortcuts map.
 * @typedef {Object} ShortcutEntry
 * @property {string} key - Lowercase key name
 * @property {boolean} [mod] - Modifier key requirement
 * @property {boolean} [shift] - Shift key requirement
 * @property {function(KeyboardEvent): void} handler - The handler function
 * @property {boolean} skipInputs - Whether to skip in input elements
 * @property {boolean} skipModals - Whether to skip when modal is open
 */

class KeyboardManager {
  /**
   * Creates a new KeyboardManager instance.
   * Note: For app use, prefer the singleton `keyboardManager` export.
   */
  constructor() {
    /** @type {Map<string, ShortcutEntry>} */
    this._shortcuts = new Map()
    /** @type {function(KeyboardEvent): void} */
    this._handler = this._dispatch.bind(this)
    /** @type {boolean} */
    this._attached = false
  }

  /**
   * Attach the document listener. Called automatically on first register().
   * @private
   * @returns {void}
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
   * @param {string} id - Unique identifier for this shortcut (used for unregister)
   * @param {ShortcutCombo} combo - Key combination to trigger the shortcut
   * @param {function(KeyboardEvent): void} handler - Function to call when shortcut is triggered
   * @param {ShortcutOptions} [options={}] - Optional behavior configuration
   * @returns {void}
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
   * @param {string} id - The shortcut ID to unregister
   * @returns {void}
   */
  unregister(id) {
    this._shortcuts.delete(id)
  }

  /**
   * Unregister all shortcuts with IDs matching a prefix.
   * Useful for cleanup when a hook is destroyed, to remove all shortcuts
   * registered by that hook without affecting others.
   * @param {string} prefix - The prefix to match (e.g., 'wb-' removes 'wb-undo', 'wb-redo', etc.)
   * @returns {void}
   * @example
   * ```js
   * // In hook destroyed():
   * keyboardManager.unregisterAll('wb-')
   * ```
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
   * @private
   * @param {KeyboardEvent} e - The keyboard event
   * @returns {void}
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
   * Resets the manager to its initial state.
   * @returns {void}
   */
  destroy() {
    if (this._attached) {
      document.removeEventListener('keydown', this._handler)
      this._attached = false
    }
    this._shortcuts.clear()
  }
}

// Export class for testing and singleton instance for app use
export { KeyboardManager }
export const keyboardManager = new KeyboardManager()
export default keyboardManager
