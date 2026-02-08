/**
 * @file KeyboardShortcuts - World Builder shortcut definitions and registration
 *
 * LLM CONTEXT:
 * - This file is DATA ONLY - no UI logic, just shortcut definitions
 * - All shortcuts use 'wb-' prefix for cleanup via `km.unregisterAll('wb-')`
 * - `mod: true` means Cmd on Mac, Ctrl on Windows/Linux (handled by KeyboardManager)
 * - `skipInputs: true` prevents shortcuts firing when user is typing in inputs
 * - Actions are string keys mapped to handlers at registration time
 *
 * WHEN TO MODIFY:
 * - Adding a new World Builder keyboard shortcut
 * - Changing key bindings (combo field)
 * - Adding new action types (requires handler in WorldBuilder hook)
 *
 * @related
 *   - assets/js/world_builder/KeyboardManager.js (processes these definitions)
 *   - assets/js/hooks/world_builder.js (provides action handlers)
 *
 * @example
 * import { registerWorldBuilderShortcuts } from '../world_builder/KeyboardShortcuts.js'
 *
 * const actions = { undo: () => undoManager.undo(), ... }
 * registerWorldBuilderShortcuts(keyboardManager, actions)
 */

/**
 * Key combination for KeyboardManager registration.
 * @typedef {Object} KeyCombo
 * @property {string} key - The key to listen for (lowercase, e.g., 'z', 'delete', 'arrowup')
 * @property {boolean} [mod] - Whether the platform modifier (Cmd/Ctrl) is required
 * @property {boolean} [shift] - Whether Shift is required
 */

/**
 * Options for keyboard shortcut registration.
 * @typedef {Object} ShortcutOptions
 * @property {boolean} [skipInputs=false] - If true, shortcut won't fire when focus is in input/textarea
 * @property {boolean} [skipModals=true] - If true, shortcut won't fire when a modal is open
 */

/**
 * A single keyboard shortcut definition.
 * @typedef {Object} ShortcutDefinition
 * @property {string} id - Unique registration ID (prefixed with 'wb-')
 * @property {KeyCombo} combo - Key combination that triggers this shortcut
 * @property {string} action - Action name to look up in the actions map
 * @property {ShortcutOptions} [options] - Optional registration options
 */

/**
 * Map of action names to handler functions.
 * @typedef {Object<string, function(): void>} ActionHandlers
 */

/**
 * KeyboardManager interface (minimal type for this file's usage).
 * @typedef {Object} KeyboardManager
 * @property {function(string, KeyCombo, function, ShortcutOptions=): void} register - Register a shortcut
 * @property {function(string): void} unregisterAll - Unregister all shortcuts with given prefix
 */

/**
 * All World Builder keyboard shortcuts.
 * @type {ShortcutDefinition[]}
 * @description
 * Each entry defines:
 * - id: Unique registration ID (prefixed with 'wb-')
 * - combo: Key combination object for KeyboardManager
 * - action: Action name mapped to a handler in the actions object
 * - options: Optional KeyboardManager registration options
 */
export const SHORTCUT_DEFINITIONS = [
  // Undo/Redo
  { id: 'wb-undo', combo: { key: 'z', mod: true, shift: false }, action: 'undo' },
  { id: 'wb-redo-z', combo: { key: 'z', mod: true, shift: true }, action: 'redo' },
  { id: 'wb-redo-y', combo: { key: 'y', mod: true }, action: 'redo' },

  // Save (validate)
  { id: 'wb-save', combo: { key: 's', mod: true }, action: 'save' },

  // Delete selected
  {
    id: 'wb-delete',
    combo: { key: 'delete', mod: false },
    action: 'deleteSelected',
    options: { skipInputs: true },
  },
  {
    id: 'wb-backspace',
    combo: { key: 'backspace', mod: false },
    action: 'deleteSelected',
    options: { skipInputs: true },
  },

  // Duplicate
  { id: 'wb-duplicate', combo: { key: 'd', mod: true }, action: 'duplicate' },

  // Select all
  { id: 'wb-select-all', combo: { key: 'a', mod: true }, action: 'selectAll' },

  // Escape: deselect
  {
    id: 'wb-escape',
    combo: { key: 'escape' },
    action: 'escape',
    options: { skipInputs: false, skipModals: false },
  },

  // Panel toggles (1-4)
  { id: 'wb-panel-1', combo: { key: '1' }, action: 'togglePanel_hierarchy' },
  { id: 'wb-panel-2', combo: { key: '2' }, action: 'togglePanel_inspector' },
  { id: 'wb-panel-3', combo: { key: '3' }, action: 'togglePanel_console' },
  { id: 'wb-panel-4', combo: { key: '4' }, action: 'togglePanel_chat' },

  // Backtick: toggle console
  { id: 'wb-console', combo: { key: '`' }, action: 'togglePanel_console' },

  // N: new room
  { id: 'wb-new-room', combo: { key: 'n' }, action: 'newRoom' },

  // /: focus search
  { id: 'wb-search', combo: { key: '/' }, action: 'focusSearch' },

  // Ctrl+G: git commit
  { id: 'wb-git', combo: { key: 'g', mod: true }, action: 'gitCommit' },

  // G: toggle grid
  { id: 'wb-grid', combo: { key: 'g' }, action: 'toggleGrid' },

  // F: fit to rooms
  { id: 'wb-fit', combo: { key: 'f' }, action: 'fitToRooms' },

  // R: reset camera
  { id: 'wb-reset', combo: { key: 'r' }, action: 'resetCamera' },

  // Ctrl+Arrow: change Z-level
  { id: 'wb-zlevel-up', combo: { key: 'arrowup', mod: true }, action: 'zLevelUp' },
  { id: 'wb-zlevel-down', combo: { key: 'arrowdown', mod: true }, action: 'zLevelDown' },

  // Z: toggle zone colors
  { id: 'wb-zones', combo: { key: 'z' }, action: 'toggleZoneColors' },

  // P: toggle NPC paths
  { id: 'wb-paths', combo: { key: 'p' }, action: 'toggleNPCPaths' },

  // ?: keyboard help
  { id: 'wb-help', combo: { key: '?' }, action: 'showHelp' },
]

/**
 * Register all World Builder shortcuts on a KeyboardManager instance.
 *
 * Iterates through SHORTCUT_DEFINITIONS and registers each with the provided
 * KeyboardManager. Missing handlers are logged as warnings but don't throw.
 *
 * @param {KeyboardManager} km - The keyboard manager instance
 * @param {ActionHandlers} actions - Map of action names to handler functions
 * @param {string} [prefix='wb-'] - ID prefix for cleanup via km.unregisterAll(prefix)
 * @returns {void}
 *
 * @example
 * // In WorldBuilder hook mounted():
 * const actions = {
 *   undo: () => this.undoManager.undo(),
 *   redo: () => this.undoManager.redo(),
 *   save: () => this.pushEvent('validate_all', {}),
 *   // ... other action handlers
 * }
 * registerWorldBuilderShortcuts(keyboardManager, actions)
 *
 * // In WorldBuilder hook destroyed():
 * keyboardManager.unregisterAll('wb-')
 */
export function registerWorldBuilderShortcuts(km, actions, _prefix = 'wb-') {
  for (const shortcut of SHORTCUT_DEFINITIONS) {
    const handler = actions[shortcut.action]
    if (!handler) {
      console.warn(`[KeyboardShortcuts] No handler for action '${shortcut.action}'`)
      continue
    }
    km.register(shortcut.id, shortcut.combo, handler, shortcut.options || {})
  }
}
