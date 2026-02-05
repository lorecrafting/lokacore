/**
 * UndoManager - Manages undo/redo stack for World Builder operations
 *
 * Features:
 * - 50-action stack limit
 * - Composite operations (batch actions)
 * - Session storage persistence
 *
 * Note: Keyboard shortcuts are handled by KeyboardManager (registered in
 * the WorldBuilder hook). UndoManager only manages the undo/redo stack.
 */

const MAX_STACK_SIZE = 50
const STORAGE_KEY = 'world_builder_undo_stack'
const COMPOSITE_TIMEOUT_MS = 30000

class UndoManager {
  constructor() {
    this.undoStack = []
    this.redoStack = []
    this.isComposing = false
    this.compositeOperations = []
    this.pushEvent = null // Will be set by WorldBuilder hook
    this.onStateChange = null // Callback for UI updates

    // Restore from session storage
    this.restore()
  }

  /**
   * Set the pushEvent function from LiveView hook
   */
  setPushEvent(pushEventFn) {
    this.pushEvent = pushEventFn
  }

  /**
   * Set callback for state changes (for UI updates)
   */
  setOnStateChange(callback) {
    this.onStateChange = callback
  }

  /**
   * Record an operation for undo/redo
   * @param {string} type - Operation type (create_room, update_room, delete_room, etc.)
   * @param {object} beforeState - State before the operation
   * @param {object} afterState - State after the operation
   * @param {object} metadata - Additional metadata (e.g., entity type, key)
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
   * Start a composite operation (for batch actions)
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
   * Cancel a composite operation without committing
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
   * End composite operation and add to stack
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
   * Undo the last operation
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
   * Redo the last undone operation
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
   * Execute a single undo operation
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
   * Execute a single redo operation
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
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0
  }

  /**
   * Get operation count for UI
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
   * Clear all history
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
   * Save to session storage
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
   * Restore from session storage
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
   * Notify state change callback
   */
  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.getState())
    }
  }

  /**
   * Clean up (no-op, retained for API compatibility)
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
