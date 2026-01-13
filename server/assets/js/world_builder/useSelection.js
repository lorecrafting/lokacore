import { useState, useCallback } from 'react'

/**
 * Selection Manager Hook
 *
 * Manages multi-select state for rooms in the World Builder.
 * Supports single selection, shift-click multi-select, and box selection.
 */
export function useSelection(onSelectionChange) {
  const [selectedKeys, setSelectedKeys] = useState(new Set())

  /**
   * Select a single room, clearing previous selection
   */
  const selectSingle = useCallback((key) => {
    const newSelection = new Set([key])
    setSelectedKeys(newSelection)
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSelection))
    }
  }, [onSelectionChange])

  /**
   * Toggle a room in the selection (for shift-click)
   */
  const toggleSelect = useCallback((key) => {
    setSelectedKeys((prev) => {
      const newSelection = new Set(prev)
      if (newSelection.has(key)) {
        newSelection.delete(key)
      } else {
        newSelection.add(key)
      }
      if (onSelectionChange) {
        onSelectionChange(Array.from(newSelection))
      }
      return newSelection
    })
  }, [onSelectionChange])

  /**
   * Add a room to the selection without clearing
   */
  const addToSelection = useCallback((key) => {
    setSelectedKeys((prev) => {
      const newSelection = new Set(prev)
      newSelection.add(key)
      if (onSelectionChange) {
        onSelectionChange(Array.from(newSelection))
      }
      return newSelection
    })
  }, [onSelectionChange])

  /**
   * Select multiple rooms by their keys
   */
  const selectMultiple = useCallback((keys) => {
    const newSelection = new Set(keys)
    setSelectedKeys(newSelection)
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSelection))
    }
  }, [onSelectionChange])

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set())
    if (onSelectionChange) {
      onSelectionChange([])
    }
  }, [onSelectionChange])

  /**
   * Check if a room is selected
   */
  const isSelected = useCallback((key) => {
    return selectedKeys.has(key)
  }, [selectedKeys])

  /**
   * Get count of selected rooms
   */
  const selectionCount = selectedKeys.size

  /**
   * Get array of selected room keys
   */
  const selection = Array.from(selectedKeys)

  return {
    selectedKeys: selection,
    selectionCount,
    isSelected,
    selectSingle,
    toggleSelect,
    addToSelection,
    selectMultiple,
    clearSelection
  }
}
