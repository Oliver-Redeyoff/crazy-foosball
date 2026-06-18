import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { TABLE } from './Table'

const SPIN_LIMIT = Math.PI * 0.55  // ~100°
const SLIDE_SENS = 0.008           // units/px
const SPIN_SENS  = 0.008           // rad/px

// ROD_Y chosen so:
//   - feet touch the floor (y=0): ROD_Y - foot_depth - foot_half_height = 0.84 - 0.78 - 0.06 = 0
//   - at spin=90° body bottom (ROD_Y - body_z/2 = 0.84 - 0.04 = 0.80) > ball top (0.48)
const ROD_Y      = 0.84
const ROD_RADIUS = 0.035

// 4-rod arcade: GK(1) · FWD(2) · FWD(2) · GK(1)
// Uniform spacing between all adjacent rods: spacing = GK_Z - FWD_Z = 2*FWD_Z → FWD_Z = GK_Z/3
const HL      = TABLE.length / 2   // 2.5
const GK_Z    = HL - 0.7           // 1.8  (0.7 buffer from end wall)
const FWD_Z   = GK_Z / 3          // 0.6  → spacing = 1.2 between every adjacent pair
const RODS = [
  { z: -GK_Z,  team: 'left'  as const, count: 1 }, // Blue GK
  { z: -FWD_Z, team: 'right' as const, count: 2 }, // Red FWD
  { z:  FWD_Z, team: 'left'  as const, count: 2 }, // Blue FWD
  { z:  GK_Z,  team: 'right' as const, count: 1 }, // Red GK
]

const INNER_HALF = TABLE.width / 2 - 0.05

// For count=2: players at ±halfSpan where halfSpan = INNER_HALF/2 so each
// player can exactly reach the pitch center (X=0) at max slide.
// For count>2: spread wider across 70% of table width.
function playerHalfSpan(count: number): number {
  if (count <= 1) return 0
  if (count === 2) return INNER_HALF / 2   // ≈ 1.475 — each player just reaches center
  return TABLE.width * 0.35               // ≈ 2.1 for 3–5 player rods
}

function slideLimit(count: number): number {
  return INNER_HALF - playerHalfSpan(count)
}

function playerXOffsets(count: number): number[] {
  if (count === 1) return [0]
  const h = playerHalfSpan(count)
  return Array.from({ length: count }, (_, i) => -h + (i * 2 * h) / (count - 1))
}

interface RodState { slide: number; spin: number }

function RodAssembly({
  rodDef,
  stateRef,
}: {
  rodDef: (typeof RODS)[0]
  stateRef: React.MutableRefObject<RodState>
}) {
  const rb             = useRef<RapierRigidBody>(null)
  const isDragging     = useRef(false)
  const lastPos        = useRef({ x: 0, y: 0 })
  const lim            = slideLimit(rodDef.count)
  const setRodDragging = useGameStore((s) => s.setRodDragging)

  const color     = rodDef.team === 'left' ? '#3b82f6' : '#ef4444'
  const glowColor = rodDef.team === 'left' ? '#93c5fd' : '#fca5a5'
  const offsets   = playerXOffsets(rodDef.count)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }
      stateRef.current.slide = Math.max(-lim, Math.min(lim, stateRef.current.slide + dx * SLIDE_SENS))
      stateRef.current.spin  = Math.max(-SPIN_LIMIT, Math.min(SPIN_LIMIT, stateRef.current.spin + dy * SPIN_SENS))
    }
    const onUp = () => {
      isDragging.current = false
      setRodDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [lim, stateRef, setRodDragging])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPointerDown = (e: any) => {
    e.stopPropagation()
    lastPos.current = { x: e.clientX, y: e.clientY }
    isDragging.current = true
    setRodDragging(true)
  }

  useFrame(() => {
    if (!rb.current) return
    rb.current.setNextKinematicTranslation({ x: stateRef.current.slide, y: ROD_Y, z: rodDef.z })
    rb.current.setNextKinematicRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(stateRef.current.spin, 0, 0))
    )
  })

  return (
    <RigidBody ref={rb} type="kinematicPosition" position={[0, ROD_Y, rodDef.z]} colliders={false}>
      {/* Wide invisible hit-area cylinder for easy clicking */}
      <mesh rotation={[0, 0, Math.PI / 2]} onPointerDown={onPointerDown}>
        <cylinderGeometry args={[ROD_RADIUS * 4, ROD_RADIUS * 4, TABLE.width + 0.5, 8]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {/* Visible rod */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, TABLE.width + 0.5, 8]} />
        <meshStandardMaterial color="#999" roughness={0.2} metalness={0.7} />
      </mesh>

      {offsets.map((xOff, i) => (
        <group key={i} position={[xOff, 0, 0]}>
          {/* Physics colliders */}
          <CuboidCollider args={[0.14, 0.27, 0.04]} position={[0, -0.26, 0]} />
          <CuboidCollider args={[0.15, 0.06, 0.04]} position={[0, -0.78, 0]} />

          {/* Visuals */}
          <mesh castShadow position={[0, -0.26, 0]} onPointerDown={onPointerDown}>
            <boxGeometry args={[0.28, 0.54, 0.08]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.78, 0]} onPointerDown={onPointerDown}>
            <boxGeometry args={[0.30, 0.12, 0.08]} />
            <meshStandardMaterial color={glowColor} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

export function Rods() {
  const rodStates = useRef<RodState[]>(RODS.map(() => ({ slide: 0, spin: 0 })))

  return (
    <group>
      {RODS.map((rod, i) => (
        <RodAssembly
          key={i}
          rodDef={rod}
          stateRef={{ current: rodStates.current[i] }}
        />
      ))}
    </group>
  )
}
