/**
 * @file storageKeys.js - Centralized storage key constants
 *
 * Single source of truth for all localStorage and sessionStorage keys
 * used in the World Builder. Prevents typos and makes it easy to find
 * all storage usage across the codebase.
 *
 * @example
 * import { STORAGE_KEYS } from '@/world_builder/storageKeys.js'
 * localStorage.getItem(STORAGE_KEYS.PANEL_SIZES)
 */

/**
 * localStorage and sessionStorage keys used by World Builder
 * @constant {Object}
 */
export const STORAGE_KEYS = {
  /**
   * Panel sizes for the World Builder grid layout.
   * Stores JSON object: { hierarchy: number, inspector: number, terminal: number, chat: number, console: number }
   * @type {string}
   * @used_by panel_resize.js
   * @storage localStorage
   */
  PANEL_SIZES: 'world_builder_panel_sizes',

  /**
   * Collapsed state for World Builder panels.
   * Stores JSON object: { hierarchy: boolean, inspector: boolean, terminal: boolean, chat: boolean }
   * @type {string}
   * @used_by world_builder.js
   * @storage localStorage
   */
  COLLAPSED_PANELS: 'world_builder_collapsed_panels',

  /**
   * Undo/redo operation stack for World Builder.
   * Stores JSON array of operation objects with type, data, and timestamp.
   * @type {string}
   * @used_by UndoManager.js
   * @storage sessionStorage
   */
  UNDO_STACK: 'world_builder_undo_stack',

  /**
   * Suffix for API key storage. Full key is `{provider}${API_KEY_SUFFIX}`.
   * Example: 'anthropic_api_key_encoded', 'openai_api_key_encoded'
   * Keys are base64 encoded for basic obfuscation (not security).
   * @type {string}
   * @used_by multi_api_key_config.js
   * @storage localStorage
   */
  API_KEY_SUFFIX: '_api_key_encoded',
}

export default STORAGE_KEYS
