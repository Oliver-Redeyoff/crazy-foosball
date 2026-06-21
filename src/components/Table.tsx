import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useGameStore } from '../store'
import { goalScale as getGoalScale } from '../twists'

export const TABLE = {
  width:     5,
  length:    8,
  wallH:     0.5,
  wallT:     0.15,
  floorY:    0,
  goalW:     2,
  goalDepth: 0.8,
  goalH:     1.3,
}

const CEILING = 2.0

// All physics + visuals whose size depends on goal dimensions.
// Keyed externally so it remounts (reinitialising Rapier bodies) when twist changes.
function GoalWalls({ goalW, goalH }: { goalW: number; goalH: number }) {
  const hw    = TABLE.width / 2
  const hl    = TABLE.length / 2
  const wt    = TABLE.wallT
  const sideW = (hw - goalW / 2) / 2  // half-width of each flanking end-wall panel

  return (
    <>
      {/* Visible flanking end walls — negative Z */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[-(goalW / 2 + sideW), TABLE.wallH / 2, -hl - wt / 2]}>
          <boxGeometry args={[sideW * 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[goalW / 2 + sideW, TABLE.wallH / 2, -hl - wt / 2]}>
          <boxGeometry args={[sideW * 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Visible flanking end walls — positive Z */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[-(goalW / 2 + sideW), TABLE.wallH / 2, hl + wt / 2]}>
          <boxGeometry args={[sideW * 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[goalW / 2 + sideW, TABLE.wallH / 2, hl + wt / 2]}>
          <boxGeometry args={[sideW * 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Goal box visuals */}
      <GoalBox position={[0, 0, -hl]} color="#8a1a1a" goalW={goalW} goalH={goalH} />
      <GoalBox position={[0, 0,  hl]} color="#1a4a8a" goalW={goalW} goalH={goalH} />

      {/* Invisible full-height end walls — negative Z */}
      <RigidBody type="fixed" restitution={0.4} friction={0.1}>
        <CuboidCollider args={[sideW, CEILING / 2, wt / 2]}
          position={[-(goalW / 2 + sideW), CEILING / 2, -hl - wt / 2]} />
        <CuboidCollider args={[sideW, CEILING / 2, wt / 2]}
          position={[goalW / 2 + sideW,   CEILING / 2, -hl - wt / 2]} />
        <CuboidCollider args={[goalW / 2, (CEILING - goalH) / 2, wt / 2]}
          position={[0, goalH + (CEILING - goalH) / 2, -hl - wt / 2]} />
      </RigidBody>

      {/* Invisible full-height end walls — positive Z */}
      <RigidBody type="fixed" restitution={0.4} friction={0.1}>
        <CuboidCollider args={[sideW, CEILING / 2, wt / 2]}
          position={[-(goalW / 2 + sideW), CEILING / 2, hl + wt / 2]} />
        <CuboidCollider args={[sideW, CEILING / 2, wt / 2]}
          position={[goalW / 2 + sideW,   CEILING / 2, hl + wt / 2]} />
        <CuboidCollider args={[goalW / 2, (CEILING - goalH) / 2, wt / 2]}
          position={[0, goalH + (CEILING - goalH) / 2, hl + wt / 2]} />
      </RigidBody>
    </>
  )
}

export function Table() {
  const hw = TABLE.width  / 2
  const hl = TABLE.length / 2
  const wt = TABLE.wallT

  const currentTwist = useGameStore((s) => s.currentTwist)
  const gScale = getGoalScale(currentTwist)
  const goalW  = TABLE.goalW * gScale
  const goalH  = TABLE.goalH * gScale

  const isIce = currentTwist === 'iceRink'

  return (
    <group>
      {/* Playing surface — keyed so Rapier remounts the collider when ice changes */}
      <RigidBody key={`floor-${isIce}`} type="fixed" friction={isIce ? 0.0 : 0.5} restitution={0.3}>
        <mesh receiveShadow position={[0, -0.05, 0]}>
          <boxGeometry args={[TABLE.width, 0.1, TABLE.length]} />
          <meshStandardMaterial color={isIce ? '#a8d8ea' : '#2d6a2d'} roughness={isIce ? 0.05 : 0.9} />
        </mesh>
      </RigidBody>

      {/* Side walls */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow receiveShadow position={[-hw - wt / 2, TABLE.wallH / 2, 0]}>
          <boxGeometry args={[wt, TABLE.wallH, TABLE.length]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow receiveShadow position={[hw + wt / 2, TABLE.wallH / 2, 0]}>
          <boxGeometry args={[wt, TABLE.wallH, TABLE.length]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Goal-size-dependent walls — remount when twist changes */}
      <GoalWalls key={`gw-${currentTwist}`} goalW={goalW} goalH={goalH} />

      {/* Corner caps (static, purely visual) */}
      {([-1, 1] as const).flatMap(sx => ([-1, 1] as const).map(sz => (
        <mesh key={`cc-${sx}-${sz}`} position={[sx * (hw + wt / 2), TABLE.wallH / 2, sz * (hl + wt / 2)]}>
          <boxGeometry args={[wt, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#5C2E00" />
        </mesh>
      )))}

      {/* Corner bumpers */}
      {([-1, 1] as const).flatMap(sx => ([-1, 1] as const).map(sz => (
        <RigidBody key={`cb-${sx}-${sz}`} type="fixed" restitution={0.9} friction={0.05}
          position={[sx * (hw - 0.18), TABLE.wallH / 2, sz * (hl - 0.18)]}
          rotation={[0, Math.atan2(-sx, -sz), 0]}
        >
          <CuboidCollider args={[0.28, TABLE.wallH / 2, 0.06]} />
          <mesh>
            <boxGeometry args={[0.56, TABLE.wallH, 0.12]} />
            <meshStandardMaterial color="#6B3410" roughness={0.6} />
          </mesh>
        </RigidBody>
      )))}

      {/* Center line & circle */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TABLE.width, 0.04]} />
        <meshStandardMaterial color="#fff" opacity={0.3} transparent />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.52, 32]} />
        <meshStandardMaterial color="#fff" opacity={0.3} transparent />
      </mesh>

      {/* Ceiling */}
      <RigidBody type="fixed" restitution={0.3} friction={0}>
        <CuboidCollider args={[hw + wt, 0.05, hl + TABLE.goalDepth + wt]} position={[0, CEILING, 0]} />
      </RigidBody>

      {/* Invisible full-height side walls */}
      <RigidBody type="fixed" restitution={0.4} friction={0.1}>
        <CuboidCollider args={[wt / 2, CEILING / 2, hl + TABLE.goalDepth + wt]}
          position={[-(hw + wt / 2), CEILING / 2, 0]} />
        <CuboidCollider args={[wt / 2, CEILING / 2, hl + TABLE.goalDepth + wt]}
          position={[hw + wt / 2, CEILING / 2, 0]} />
      </RigidBody>
    </group>
  )
}

function GoalBox({ position, color, goalW, goalH }: {
  position: [number, number, number]
  color: string
  goalW: number
  goalH: number
}) {
  const gd   = TABLE.goalDepth
  const pw   = 0.07   // post / crossbar width
  const wt   = TABLE.wallT
  const sign = position[2] < 0 ? -1 : 1

  return (
    <group position={position}>
      {/* Physics — net walls with very low restitution so the ball dies on contact */}
      <RigidBody type="fixed" restitution={0.05} friction={0.9}>
        {/* Back net */}
        <CuboidCollider args={[goalW / 2, goalH / 2, wt / 2]}
          position={[0, goalH / 2, sign * gd]} />
        {/* Left side net */}
        <CuboidCollider args={[wt / 2, goalH / 2, gd / 2]}
          position={[-goalW / 2, goalH / 2, sign * gd / 2]} />
        {/* Right side net */}
        <CuboidCollider args={[wt / 2, goalH / 2, gd / 2]}
          position={[goalW / 2, goalH / 2, sign * gd / 2]} />
        {/* Top net */}
        <CuboidCollider args={[goalW / 2, wt / 2, gd / 2]}
          position={[0, goalH, sign * gd / 2]} />
        {/* Floor (main floor doesn't extend into goal area) */}
        <CuboidCollider args={[goalW / 2, wt / 2, gd / 2]}
          position={[0, -wt / 2, sign * gd / 2]} />
      </RigidBody>
      {/* Green pitch floor */}
      <mesh receiveShadow position={[0, 0.002, sign * gd / 2]}>
        <boxGeometry args={[goalW, 0.02, gd]} />
        <meshStandardMaterial color="#2d6a2d" roughness={0.9} />
      </mesh>

      {/* Front posts & crossbar (at the goal mouth) */}
      <mesh castShadow position={[-goalW / 2, goalH / 2, 0]}>
        <boxGeometry args={[pw, goalH, pw]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh castShadow position={[goalW / 2, goalH / 2, 0]}>
        <boxGeometry args={[pw, goalH, pw]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh castShadow position={[0, goalH, 0]}>
        <boxGeometry args={[goalW + pw, pw, pw]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>

      {/* Back posts & crossbar */}
      <mesh castShadow position={[-goalW / 2, goalH / 2, sign * gd]}>
        <boxGeometry args={[pw, goalH, pw]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh castShadow position={[goalW / 2, goalH / 2, sign * gd]}>
        <boxGeometry args={[pw, goalH, pw]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh castShadow position={[0, goalH, sign * gd]}>
        <boxGeometry args={[goalW + pw, pw, pw]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>

      {/* Top side rails connecting front to back */}
      <mesh castShadow position={[-goalW / 2, goalH, sign * gd / 2]}>
        <boxGeometry args={[pw, pw, gd]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh castShadow position={[goalW / 2, goalH, sign * gd / 2]}>
        <boxGeometry args={[pw, pw, gd]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>

      {/* Net — back */}
      <mesh position={[0, goalH / 2, sign * (gd - pw / 2)]}>
        <planeGeometry args={[goalW - pw, goalH, 16, 10]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
      {/* Net — left side */}
      <mesh position={[-goalW / 2 + pw / 2, goalH / 2, sign * gd / 2]}
            rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[gd, goalH, 8, 10]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
      {/* Net — right side */}
      <mesh position={[goalW / 2 - pw / 2, goalH / 2, sign * gd / 2]}
            rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[gd, goalH, 8, 10]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
      {/* Net — top */}
      <mesh position={[0, goalH - pw / 2, sign * gd / 2]}
            rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[goalW - pw, gd, 16, 8]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
    </group>
  )
}
