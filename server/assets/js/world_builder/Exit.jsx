import React from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Exit Arrow Component
 *
 * Renders a 3D arrow from one room to another representing an exit connection.
 * The arrow points from the source room to the destination room.
 */
export default function Exit({ from, to, direction, color = '#ffaa00' }) {
  if (!from || !to) return null

  // Calculate start and end positions
  // Y-offset to prevent z-fighting with room cubes
  const start = new THREE.Vector3(from.x, 1.5, from.y)
  const end = new THREE.Vector3(to.x, 1.5, to.y)

  // Calculate direction vector for arrow head
  const dir = new THREE.Vector3().subVectors(end, start).normalize()

  // Shorten the line slightly so it doesn't overlap with room cubes
  const lineStart = start.clone().add(dir.clone().multiplyScalar(1.2))
  const lineEnd = end.clone().sub(dir.clone().multiplyScalar(1.2))

  // Calculate arrow head position (90% along the line)
  const arrowPos = lineStart.clone().lerp(lineEnd, 0.9)

  return (
    <group>
      {/* Main line */}
      <Line
        points={[lineStart.toArray(), lineEnd.toArray()]}
        color={color}
        lineWidth={2}
        dashed={false}
      />

      {/* Arrow head (cone) */}
      <mesh position={arrowPos.toArray()} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Direction label (optional, for debugging) */}
      {direction && (
        <mesh position={arrowPos.toArray()}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Exit Direction Colors
 * Standard color mapping for common exit directions
 */
export const ExitColors = {
  north: '#4a9eff',
  south: '#ff4a9e',
  east: '#4aff9e',
  west: '#ff9e4a',
  up: '#9e4aff',
  down: '#ffff4a',
  northeast: '#4affff',
  northwest: '#ff4aff',
  southeast: '#4affaa',
  southwest: '#ffaa4a',
  default: '#aaaaaa'
}

/**
 * Get color for exit direction
 */
export function getExitColor(direction) {
  return ExitColors[direction?.toLowerCase()] || ExitColors.default
}
