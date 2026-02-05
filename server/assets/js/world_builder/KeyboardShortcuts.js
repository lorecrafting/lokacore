/**
 * KeyboardShortcuts - World Builder shortcut definitions and registration.
 *
 * Extracted from world_builder.js to separate shortcut data from hook logic.
 * Each shortcut has an id, key combo, action name, and optional registration options.
 *
 * Usage:
 *   import { registerWorldBuilderShortcuts } from '../world_builder/KeyboardShortcuts.js'
 *
 *   const actions = { undo: () => undoManager.undo(), ... }
 *   registerWorldBuilderShortcuts(keyboardManager, actions)
 */

/**
 * All World Builder keyboard shortcuts.
 * Each entry defines:
 *   id      - Unique registration ID (prefixed with 'wb-')
 *   combo   - Key combination object for KeyboardManager
 *   action  - Action name mapped to a handler in the actions object
 *   options - Optional KeyboardManager registration options
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
 * @param {KeyboardManager} km - The keyboard manager instance
 * @param {Object} actions - Map of action names to handler functions
 * @param {string} [prefix='wb-'] - ID prefix for cleanup via km.unregisterAll(prefix)
 */
export function registerWorldBuilderShortcuts(km, actions, prefix = 'wb-') {
  for (const shortcut of SHORTCUT_DEFINITIONS) {
    const handler = actions[shortcut.action]
    if (!handler) {
      console.warn(`[KeyboardShortcuts] No handler for action '${shortcut.action}'`)
      continue
    }
    km.register(shortcut.id, shortcut.combo, handler, shortcut.options || {})
  }
}
