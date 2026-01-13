import React from 'react'
import { Canvas } from '@react-three/fiber'
import Viewport from './Viewport'
import { useSelection } from './useSelection'

/**
 * World Builder React App
 *
 * React Three Fiber application for 3D world visualization.
 * Mounted into LiveView via WorldBuilder hook.
 * Supports multi-select and batch operations.
 */
export default function App({ rooms = [], selectedRoom = null, onSelectRoom, onBatchSelect }) {
  // Multi-select state
  const selection = useSelection((keys) => {
    // Notify LiveView of selection changes
    if (onBatchSelect) {
      onBatchSelect(keys)
    }
  })

  // Handle room click with shift-key support
  const handleRoomClick = (key, shiftKey) => {
    if (shiftKey) {
      // Shift-click: toggle in selection
      selection.toggleSelect(key)
    } else if (selection.selectionCount > 0) {
      // Clear multi-select and select single
      selection.selectSingle(key)
      if (onSelectRoom) {
        onSelectRoom(key)
      }
    } else {
      // Normal single selection
      if (onSelectRoom) {
        onSelectRoom(key)
      }
    }
  }

  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Viewport
        rooms={rooms}
        selectedRoom={selectedRoom}
        selectedKeys={selection.selectedKeys}
        onSelectRoom={handleRoomClick}
        onBoxSelect={selection.selectMultiple}
        isSelected={selection.isSelected}
      />
    </Canvas>
  )
}
