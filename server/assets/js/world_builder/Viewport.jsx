import React, { useRef, useMemo, useEffect } from 'react'
import { OrbitControls, Grid, Text, Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Exit, { getExitColor } from './Exit'

// Camera preset positions
const CAMERA_PRESETS = {
  perspective: { position: [15, 15, 15], target: [0, 0, 0] },
  top: { position: [0, 30, 0], target: [0, 0, 0] },
  front: { position: [0, 5, 30], target: [0, 0, 0] },
  side: { position: [30, 5, 0], target: [0, 0, 0] },
}

/**
 * 3D Viewport Component
 *
 * Renders the main 3D scene with:
 * - Grid floor for reference
 * - Orbit camera controls
 * - Room cubes with labels
 * - Exit arrows connecting rooms
 * - Multi-select support
 * - Lighting
 * - Camera view presets (Perspective, Top, Front, Side)
 */
export default function Viewport({ rooms, selectedRoom, selectedKeys = [], validation = {}, onSelectRoom, isSelected, cameraView = 'perspective' }) {
  const controlsRef = useRef()
  const { camera } = useThree()

  // Debug: Log when component renders
  console.log('[Viewport] Rendering with', rooms?.length || 0, 'rooms, camera:', cameraView)

  // Handle camera view changes
  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraView] || CAMERA_PRESETS.perspective
    if (camera && controlsRef.current) {
      // Animate camera to new position
      camera.position.set(...preset.position)
      controlsRef.current.target.set(...preset.target)
      controlsRef.current.update()
    }
  }, [cameraView, camera])
  // Build a lookup map for quick room access by key
  const roomsByKey = useMemo(() => {
    const map = new Map()
    rooms.forEach(room => {
      map.set(room.key, room)
      if (room.id) map.set(room.id, room)
    })
    return map
  }, [rooms])

  // Build exit connections for rendering
  const exitConnections = useMemo(() => {
    const connections = []

    rooms.forEach(room => {
      if (!room.exits) return

      Object.entries(room.exits).forEach(([direction, destKey]) => {
        const destRoom = roomsByKey.get(destKey)
        if (destRoom) {
          connections.push({
            key: `${room.key}-${direction}-${destKey}`,
            from: room,
            to: destRoom,
            direction,
            color: getExitColor(direction)
          })
        }
      })
    })

    return connections
  }, [rooms, roomsByKey])

  return (
    <>
      {/* DEBUG: Test cube at origin */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshBasicMaterial color="red" />
      </mesh>

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />

      {/* Camera Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={100}
        makeDefault
      />

      {/* Grid Floor */}
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#444444"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#666666"
        fadeDistance={50}
        fadeStrength={1}
        position={[0, -0.01, 0]}
      />

      {/* Render Exit Arrows */}
      {exitConnections.map((exit) => (
        <Exit
          key={exit.key}
          from={exit.from}
          to={exit.to}
          direction={exit.direction}
          color={exit.color}
        />
      ))}

      {/* Render Room Cubes */}
      {rooms.map((room) => (
        <RoomCube
          key={room.key}
          room={room}
          selected={selectedRoom === room.key}
          multiSelected={isSelected && isSelected(room.key)}
          validationStatus={validation[room.key]?.status || 'valid'}
          onSelect={onSelectRoom}
        />
      ))}
    </>
  )
}

/**
 * Room Cube Component
 *
 * Renders a single room as a cube with a text label.
 * Supports single selection and multi-selection with different highlighting.
 * Shows icons for NPCs (👤) and items (📦) inside the cube.
 * Shows validation glow: red=error, yellow=warning, none=valid
 */
function RoomCube({ room, selected, multiSelected, validationStatus = 'valid', onSelect }) {
  const meshRef = useRef()
  const { x = 0, y = 0, z = 0, name, spawns = {} } = room
  const { npcs = [], items = [] } = spawns

  const handleClick = (e) => {
    e.stopPropagation()
    if (onSelect) {
      // Pass the shift key state to the parent
      onSelect(room.key, e.shiftKey)
    }
  }

  // Determine cube color based on selection and validation state
  // Priority: selection > validation
  let cubeColor = '#7eb3ff'  // Default blue
  let emissiveColor = '#0a0a0a'
  let emissiveIntensity = 0

  if (multiSelected) {
    cubeColor = '#ffaa00'
    emissiveColor = '#ff8800'
    emissiveIntensity = 0.3
  } else if (selected) {
    cubeColor = '#4a9eff'
    emissiveColor = '#2a5eff'
    emissiveIntensity = 0.3
  } else {
    // Show validation glow when not selected
    switch (validationStatus) {
      case 'error':
        cubeColor = '#ff6b6b'  // Light red
        emissiveColor = '#EF4444'  // Red glow
        emissiveIntensity = 0.4
        break
      case 'warning':
        cubeColor = '#ffd93d'  // Light yellow
        emissiveColor = '#F59E0B'  // Yellow glow
        emissiveIntensity = 0.3
        break
      default:
        // Valid - default blue, no glow
        break
    }
  }

  // Build icon display - show up to 3 icons, then count
  const npcCount = npcs.length
  const itemCount = items.length
  const hasContents = npcCount > 0 || itemCount > 0

  return (
    <group position={[x, 1, y]}>
      {/* Cube */}
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={cubeColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      {/* Selection outline for multi-selected rooms */}
      {multiSelected && !selected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(2.1, 2.1, 2.1)]} />
          <lineBasicMaterial color="#ffaa00" linewidth={2} />
        </lineSegments>
      )}

      {/* Entity Icons inside the cube */}
      {hasContents && (
        <Html
          position={[0, 0, 1.01]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}>
            {/* NPC icons */}
            {npcCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}>
                {npcCount <= 3 ? (
                  // Show individual icons for 1-3 NPCs
                  [...Array(npcCount)].map((_, i) => (
                    <span key={`npc-${i}`} style={{
                      fontSize: '16px',
                      filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
                      color: '#8B5CF6',
                    }}>👤</span>
                  ))
                ) : (
                  // Show icon with count for 4+ NPCs
                  <>
                    <span style={{
                      fontSize: '16px',
                      filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
                      color: '#8B5CF6',
                    }}>👤</span>
                    <span style={{
                      fontSize: '12px',
                      color: '#8B5CF6',
                      fontWeight: 'bold',
                      textShadow: '0 0 3px rgba(0,0,0,0.8)',
                    }}>×{npcCount}</span>
                  </>
                )}
              </div>
            )}
            {/* Item icons */}
            {itemCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}>
                {itemCount <= 3 ? (
                  // Show individual icons for 1-3 items
                  [...Array(itemCount)].map((_, i) => (
                    <span key={`item-${i}`} style={{
                      fontSize: '14px',
                      filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
                      color: '#EAB308',
                    }}>📦</span>
                  ))
                ) : (
                  // Show icon with count for 4+ items
                  <>
                    <span style={{
                      fontSize: '14px',
                      filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
                      color: '#EAB308',
                    }}>📦</span>
                    <span style={{
                      fontSize: '12px',
                      color: '#EAB308',
                      fontWeight: 'bold',
                      textShadow: '0 0 3px rgba(0,0,0,0.8)',
                    }}>×{itemCount}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Room Label */}
      <Text
        position={[0, 2, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {name}
      </Text>

      {/* Room Key (smaller text below) */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.25}
        color="#aaaaaa"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {room.key}
      </Text>
    </group>
  )
}
