/**
 * UndoManager - Manages undo/redo stack for World Builder operations.
 *
 * Features:
 * - 50-action stack limit (oldest operations are discarded)
 * - Composite operations for batch actions (group multiple operations as one undo unit)
 * - Session storage persistence (survives page refresh within same session)
 * - Automatic 30-second timeout for unclosed composite operations
 *
 * This is a singleton class - use the exported `undoManager` instance for app use,
 * or import the `UndoManager` class directly for testing purposes.
 *
 * Note: Keyboard shortcuts are handled by KeyboardManager (registered in
 * the WorldBuilder hook). UndoManager only manages the undo/redo stack.
 *
 * @example
 * ```js
 * import { undoManager } from '../world_builder/UndoManager.js'
 *
 * // Record an operation
 * undoManager.record('update_room', { name: 'Old' }, { name: 'New' }, { key: 'room_1' })
 *
 * // Batch operations
 * undoManager.beginComposite('move_multiple')
 * undoManager.record('update_room', before1, after1, meta1)
 * undoManager.record('update_room', before2, after2, meta2)
 * undoManager.endComposite()
 *
 * // Undo/Redo
 * undoManager.undo()
 * undoManager.redo()
 * ```
 */

/**
 * A single undoable operation.
 * @typedef {Object} Operation
 * @property {string} type - Operation type (e.g., 'create_room', 'update_room', 'delete_room')
 * @property {Object} beforeState - State before the operation (used for undo)
 * @property {Object} afterState - State after the operation (used for redo)
 * @property {Object} metadata - Additional metadata (e.g., entity type, key)
 * @property {number} timestamp - Unix timestamp when operation was recorded
 */

/**
 * A composite operation containing multiple sub-operations.
 * @typedef {Object} CompositeOperation
 * @property {'composite'} type - Always 'composite' for composite operations
 * @property {Operation[]} operations - Array of sub-operations
 * @property {string} label - Label describing the composite (e.g., 'batch_move')
 * @property {number} timestamp - Unix timestamp when composite was completed
 */

/**
 * State information for UI updates.
 * @typedef {Object} UndoState
 * @property {number} undoCount - Number of operations in undo stack
 * @property {number} redoCount - Number of operations in redo stack
 * @property {boolean} canUndo - Whether undo is available
 * @property {boolean} canRedo - Whether redo is available
 * @property {Operation|CompositeOperation|null} lastOperation - The most recent operation, or null if stack is empty
 */

/**
 * Callback for state change notifications.
 * @callback StateChangeCallback
 * @param {UndoState} state - The current undo/redo state
 * @returns {void}
 */

/** @type {number} Maximum number of operations to keep in the undo stack */
const MAX_STACK_SIZE = 50
/** @type {string} Session storage key for persisting undo/redo stacks */
const STORAGE_KEY = 'world_builder_undo_stack'
/** @type {number} Timeout in ms before auto-cancelling unclosed composite operations */
const COMPOSITE_TIMEOUT_MS = 30000

class UndoManager {
  /**
   * Creates a new UndoManager instance.
   * Automatically restores state from session storage.
   * Note: For app use, prefer the singleton `undoManager` export.
   */
  constructor() {
    /** @type {(Operation|CompositeOperation)[]} */
    this.undoStack = []
    /** @type {(Operation|CompositeOperation)[]} */
    this.redoStack = []
    /** @type {boolean} */
    this.isComposing = false
    /** @type {Operation[]} */
    this.compositeOperations = []
    /** @type {function(string, Object): void|null} Will be set by WorldBuilder hook */
    this.pushEvent = null
    /** @type {StateChangeCallback|null} Callback for UI updates */
    this.onStateChange = null
    /** @type {number|null} */
    this._compositeTimeout = null
    /** @type {string} */
    this.compositeLabel = ''

    // Restore from session storage
    this.restore()
  }

  /**
   * Set the pushEvent function from LiveView hook.
   * Must be called before undo/redo operations will work.
   * @param {function(string, Object): void} pushEventFn - The LiveView hook's pushEvent function
   * @returns {void}
   */
  setPushEvent(pushEventFn) {
    this.pushEvent = pushEventFn
  }

  /**
   * Set callback for state changes (for UI updates).
   * Called after every operation that modifies the stacks.
   * @param {StateChangeCallback} callback - Function to call with state updates
   * @returns {void}
   */
  setOnStateChange(callback) {
    this.onStateChange = callback
  }

  /**
   * Record an operation for undo/redo.
   * If a composite operation is in progress, the operation is added to the composite.
   * Otherwise, it's added directly to the undo stack and the redo stack is cleared.
   * @param {string} type - Operation type (e.g., 'create_room', 'update_room', 'delete_room')
   * @param {Object} beforeState - State before the operation (used for undo)
   * @param {Object} afterState - State after the operation (used for redo)
   * @param {Object} [metadata={}] - Additional metadata (e.g., entity type, key)
   * @returns {void}
   */
  record(type, beforeState, afterState, metadata = {}) {
    const operation = {
      type,
      beforeState,
      afterState,
      metadata,
      timestamp: Date.now()
    }

    if (this.isComposing) {
      // Add to composite operation
      this.compositeOperations.push(operation)
    } else {
      // Add to undo stack
      this.undoStack.push(operation)

      // Clear redo stack when new operation is recorded
      this.redoStack = []

      // Enforce max stack size
      while (this.undoStack.length > MAX_STACK_SIZE) {
        this.undoStack.shift()
      }

      this.save()
      this.notifyStateChange()
    }
  }

  /**
   * Start a composite operation (for batch actions).
   * All operations recorded while composing will be grouped into a single undo unit.
   * Must be followed by endComposite() or cancelComposite().
   * Auto-cancels after 30 seconds if not ended (safety mechanism).
   * @param {string} [label='batch'] - Label describing the composite operation
   * @returns {void}
   */
  beginComposite(label = 'batch') {
    if (this._compositeTimeout) clearTimeout(this._compositeTimeout)
    this.isComposing = true
    this.compositeOperations = []
    this.compositeLabel = label
    this._compositeTimeout = setTimeout(() => {
      if (this.isComposing) {
        console.warn('[UndoManager] Composite auto-cancelled after 30s timeout')
        this.cancelComposite()
      }
    }, COMPOSITE_TIMEOUT_MS)
  }

  /**
   * Cancel a composite operation without committing.
   * Discards all operations recorded since beginComposite() was called.
   * @returns {void}
   */
  cancelComposite() {
    if (this.isComposing) {
      console.warn('[UndoManager] Composite operation cancelled')
      this.isComposing = false
      this.compositeOperations = []
      if (this._compositeTimeout) {
        clearTimeout(this._compositeTimeout)
        this._compositeTimeout = null
      }
    }
  }

  /**
   * End composite operation and add to stack.
   * Groups all operations recorded since beginComposite() into a single undo unit.
   * If no operations were recorded, nothing is added to the stack.
   * @returns {void}
   */
  endComposite() {
    if (this._compositeTimeout) {
      clearTimeout(this._compositeTimeout)
      this._compositeTimeout = null
    }

    if (this.isComposing && this.compositeOperations.length > 0) {
      this.undoStack.push({
        type: 'composite',
        operations: this.compositeOperations,
        label: this.compositeLabel,
        timestamp: Date.now()
      })

      // Clear redo stack
      this.redoStack = []

      // Enforce max stack size
      while (this.undoStack.length > MAX_STACK_SIZE) {
        this.undoStack.shift()
      }

      this.save()
      this.notifyStateChange()
    }

    this.isComposing = false
    this.compositeOperations = []
  }

  /**
   * Undo the last operation.
   * Moves the operation from undo stack to redo stack and executes the undo.
   * For composite operations, undoes all sub-operations in reverse order.
   * @returns {boolean} True if an operation was undone, false if stack was empty
   */
  undo() {
    if (this.undoStack.length === 0) {
      console.log('[UndoManager] Nothing to undo')
      return false
    }

    const operation = this.undoStack.pop()
    this.redoStack.push(operation)

    if (operation.type === 'composite') {
      // Undo composite operations in reverse order
      for (let i = operation.operations.length - 1; i >= 0; i--) {
        this.executeUndo(operation.operations[i])
      }
    } else {
      this.executeUndo(operation)
    }

    this.save()
    this.notifyStateChange()
    return true
  }

  /**
   * Redo the last undone operation.
   * Moves the operation from redo stack to undo stack and executes the redo.
   * For composite operations, redoes all sub-operations in order.
   * @returns {boolean} True if an operation was redone, false if stack was empty
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log('[UndoManager] Nothing to redo')
      return false
    }

    const operation = this.redoStack.pop()
    this.undoStack.push(operation)

    if (operation.type === 'composite') {
      // Redo composite operations in order
      for (const op of operation.operations) {
        this.executeRedo(op)
      }
    } else {
      this.executeRedo(operation)
    }

    this.save()
    this.notifyStateChange()
    return true
  }

  /**
   * Execute a single undo operation by sending event to LiveView.
   * @private
   * @param {Operation} operation - The operation to undo
   * @returns {void}
   */
  executeUndo(operation) {
    if (!this.pushEvent) {
      console.error('[UndoManager] pushEvent not set')
      return
    }

    // Send undo event to LiveView
    this.pushEvent('undo_operation', {
      type: operation.type,
      state: operation.beforeState,
      metadata: operation.metadata
    })
  }

  /**
   * Execute a single redo operation by sending event to LiveView.
   * @private
   * @param {Operation} operation - The operation to redo
   * @returns {void}
   */
  executeRedo(operation) {
    if (!this.pushEvent) {
      console.error('[UndoManager] pushEvent not set')
      return
    }

    // Send redo event to LiveView
    this.pushEvent('redo_operation', {
      type: operation.type,
      state: operation.afterState,
      metadata: operation.metadata
    })
  }

  /**
   * Check if undo is available.
   * @returns {boolean} True if there are operations to undo
   */
  canUndo() {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available.
   * @returns {boolean} True if there are operations to redo
   */
  canRedo() {
    return this.redoStack.length > 0
  }

  /**
   * Get current state for UI display.
   * @returns {UndoState} Current undo/redo state
   */
  getState() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      lastOperation: this.undoStack[this.undoStack.length - 1] || null
    }
  }

  /**
   * Clear all history.
   * Resets both undo and redo stacks to empty.
   * Also cancels any in-progress composite operation.
   * @returns {void}
   */
  clear() {
    this.undoStack = []
    this.redoStack = []
    this.isComposing = false
    this.compositeOperations = []
    if (this._compositeTimeout) {
      clearTimeout(this._compositeTimeout)
      this._compositeTimeout = null
    }
    this.save()
    this.notifyStateChange()
  }

  /**
   * Save undo/redo stacks to session storage.
   * @private
   * @returns {void}
   */
  save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        undoStack: this.undoStack,
        redoStack: this.redoStack
      }))
    } catch (e) {
      console.warn('[UndoManager] Failed to save to session storage', e)
    }
  }

  /**
   * Restore undo/redo stacks from session storage.
   * Called automatically in constructor.
   * @private
   * @returns {void}
   */
  restore() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { undoStack, redoStack } = JSON.parse(saved)
        this.undoStack = undoStack || []
        this.redoStack = redoStack || []
      }
    } catch (e) {
      console.warn('[UndoManager] Failed to restore from session storage', e)
    }
  }

  /**
   * Notify state change callback if set.
   * @private
   * @returns {void}
   */
  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.getState())
    }
  }

  /**
   * Clean up resources.
   * Clears any pending composite timeout.
   * Note: Keyboard shortcuts are managed by KeyboardManager, not UndoManager.
   * @returns {void}
   */
  destroy() {
    if (this._compositeTimeout) {
      clearTimeout(this._compositeTimeout)
      this._compositeTimeout = null
    }
    // Keyboard shortcuts are managed by KeyboardManager, not UndoManager
  }
}

// Export class for testing and singleton instance for app use
export { UndoManager }
export const undoManager = new UndoManager()
export default undoManager
