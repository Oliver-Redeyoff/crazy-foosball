import { useRef, useEffect, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { TABLE } from './Table'
import { ballPos, ballVel } from '../ballState'
import { useGameStore } from '../store'

const SPIN_LIMIT   = Math.PI * 0.55
const SLIDE_SENS   = 0.008
const MAX_SPIN_VEL = 10.0
const RETURN_SPEED = 5.0
const ROD_Y = 0.84

// Interleaved layout: Red GK · Blue FWD · Red MID · Blue MID · Red FWD · Blue GK
// Red attacks +Z, Blue attacks -Z
const HL    = TABLE.length / 2   // 2.5
const S     = 0.6
const GK_Z  = HL - S             // 1.9
const MID_Z = (HL + S / 2) / 2  // 1.4
const FWD_Z = S                  // 0.6

const RODS = [
  { z: -GK_Z,  team: 'right' as const, count: 1 }, // Red GK  (defends −Z goal)
  { z: -MID_Z, team: 'left'  as const, count: 2 }, // Blue FWD
  { z: -FWD_Z, team: 'right' as const, count: 3 }, // Red MID
  { z:  FWD_Z, team: 'left'  as const, count: 3 }, // Blue MID
  { z:  MID_Z, team: 'right' as const, count: 2 }, // Red FWD
  { z:  GK_Z,  team: 'left'  as const, count: 1 }, // Blue GK (defends +Z goal)
]

const PLAYER_TEAM = 'left'  as const
const AI_TEAM     = 'right' as const

// Map each RODS index → AI rod index (0,1,2) or -1 if player rod
const ROD_AI_IDX = (() => {
  let ai = 0
  return RODS.map(r => r.team === AI_TEAM ? ai++ : -1)
})()
// ROD_AI_IDX = [0, -1, 1, -1, 2, -1]

// Rule-based fallback tuning
const AI_SLIDE_GK   = 2.5
const AI_SLIDE_FWD  = 4.5
const AI_SLIDE_MID  = 3.5
const AI_KICK_Z     = 0.45
const AI_KICK_X     = 0.32

const INNER_HALF = TABLE.width / 2 - 0.05  // 1.7

function playerHalfSpan(count: number): number {
  if (count <= 1) return 0
  if (count === 2) return INNER_HALF / 2
  return TABLE.width * 0.35
}
function slideLimit(count: number): number {
  return INNER_HALF - playerHalfSpan(count)
}
function playerXOffsets(count: number): number[] {
  if (count === 1) return [0]
  const h = playerHalfSpan(count)
  return Array.from({ length: count }, (_, i) => -h + (i * 2 * h) / (count - 1))
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Control { slide: number; spin: number }
type Phase = 'idle' | 'firing' | 'returning'

interface AiRodState {
  slide: number
  spin: number
  phase: Phase
  targetSpin: number
  idleTimer: number
}

// ─── Kick state machine (one AI rod) ─────────────────────────────────────────

function tickKick(state: AiRodState, trigger: boolean, delta: number) {
  switch (state.phase) {
    case 'idle':
      state.idleTimer += delta
      if (state.idleTimer >= 0.25 && trigger) {
        state.phase = 'firing'
        state.targetSpin = -SPIN_LIMIT
        state.idleTimer = 0
      }
      break
    case 'firing':
      state.spin -= MAX_SPIN_VEL * delta
      if (state.spin <= state.targetSpin) {
        state.spin = state.targetSpin
        state.phase = 'returning'
      }
      break
    case 'returning':
      state.spin = THREE.MathUtils.lerp(state.spin, 0, RETURN_SPEED * delta)
      if (Math.abs(state.spin) < 0.005) {
        state.spin = 0
        state.phase = 'idle'
      }
      break
  }
}

// ─── Rule-based fallback (used while ONNX model loads) ────────────────────────

function tickRuleBasedAI(state: AiRodState, rodDef: typeof RODS[0], delta: number) {
  const bx = ballPos.x
  const bz = ballPos.z
  const lim = slideLimit(rodDef.count)
  const isGK = rodDef.count === 1
  const speed = isGK ? AI_SLIDE_GK : rodDef.count === 3 ? AI_SLIDE_MID : AI_SLIDE_FWD

  const vz = ballVel.z
  const dz = rodDef.z - bz
  const offsets = playerXOffsets(rodDef.count)

  // Ball is on the +Z attack side of the rod (Red attacks +Z)
  const ballInFront = bz >= rodDef.z - 0.12

  let target: number
  if (!ballInFront) {
    // Ball is behind the rod — slide to the opposite side to open a lane for it to pass
    target = Math.max(-lim, Math.min(lim, -bx))
  } else {
    // Predictive slide: extrapolate ball X to when it reaches this rod's Z
    let predictedX = bx
    if (Math.abs(vz) > 0.08) {
      const t = dz / vz
      if (t > 0 && t < 0.6) predictedX = bx + ballVel.x * t
    }

    let bestOff = offsets[0]
    let minDist = Infinity
    for (const off of offsets) {
      const d = Math.abs(predictedX - off)
      if (d < minDist) { minDist = d; bestOff = off }
    }
    target = Math.max(-lim, Math.min(lim, predictedX - bestOff))

    if (isGK) {
      const distFromZone = Math.abs(bz - rodDef.z)
      const pull = THREE.MathUtils.clamp((distFromZone - 0.8) / 2.0, 0, 0.6)
      target = THREE.MathUtils.lerp(target, 0, pull)
    }
  }

  state.slide = THREE.MathUtils.lerp(state.slide, target, speed * delta)

  const movingAway = Math.abs(vz) > 0.4 && (vz * dz < 0)
  const aligned = offsets.some(o => Math.abs(state.slide + o - bx) < AI_KICK_X)
  tickKick(state, ballInFront && !movingAway && Math.abs(bz - rodDef.z) < AI_KICK_Z && aligned, delta)
}

// ─── RodAssembly ─────────────────────────────────────────────────────────────

function RodAssembly({
  rodDef,
  controlRef,
}: {
  rodDef: typeof RODS[0]
  controlRef: MutableRefObject<Control>
}) {
  const rb      = useRef<RapierRigidBody>(null)
  const lim     = slideLimit(rodDef.count)
  const color   = rodDef.team === 'left' ? '#3b82f6' : '#ef4444'
  const accent  = rodDef.team === 'left' ? '#93c5fd' : '#fca5a5'
  const offsets = playerXOffsets(rodDef.count)

  useFrame(() => {
    if (!rb.current) return
    const { slide, spin } = controlRef.current
    const s = Math.max(-lim, Math.min(lim, slide))
    rb.current.setNextKinematicTranslation({ x: s, y: ROD_Y, z: rodDef.z })
    rb.current.setNextKinematicRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(spin, 0, 0))
    )
  })

  return (
    <RigidBody ref={rb} type="kinematicPosition" position={[0, ROD_Y, rodDef.z]} colliders={false}>
      {offsets.map((xOff, i) => (
        <group key={i} position={[xOff, 0, 0]}>
          <CuboidCollider args={[0.14, 0.27, 0.04]} position={[0, -0.26, 0]} />
          <CuboidCollider args={[0.15, 0.06, 0.04]} position={[0, -0.78, 0]} />
          <mesh castShadow position={[0, -0.26, 0]}>
            <boxGeometry args={[0.28, 0.54, 0.08]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.78, 0]}>
            <boxGeometry args={[0.30, 0.12, 0.08]} />
            <meshStandardMaterial color={accent} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

// ─── Rods ─────────────────────────────────────────────────────────────────────

export function Rods() {
  const playerControl = useRef<Control>({ slide: 0, spin: 0 })

  // One independent control ref per AI rod (GK=0, MID=1, FWD=2)
  const aiControl0 = useRef<Control>({ slide: 0, spin: 0 })
  const aiControl1 = useRef<Control>({ slide: 0, spin: 0 })
  const aiControl2 = useRef<Control>({ slide: 0, spin: 0 })
  const aiControls = [aiControl0, aiControl1, aiControl2]

  const aiState = useRef<AiRodState[]>([
    { slide: 0, spin: 0, phase: 'idle', targetSpin: 0, idleTimer: 0 },
    { slide: 0, spin: 0, phase: 'idle', targetSpin: 0, idleTimer: 0 },
    { slide: 0, spin: 0, phase: 'idle', targetSpin: 0, idleTimer: 0 },
  ])

  const currentTwist = useGameStore((s) => s.currentTwist)
  const reversedRef  = useRef(false)
  useEffect(() => { reversedRef.current = currentTwist === 'reverseControls' }, [currentTwist])

  // Player input state
  const slideRef    = useRef(0)
  const lastClientY = useRef(-1)
  const spinRef     = useRef(0)
  const angVel      = useRef(0)   // angular velocity of player rod (rad/s)
  const keyA        = useRef(false)
  const keyD        = useRef(false)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (lastClientY.current < 0) { lastClientY.current = e.clientY; return }
      const dir = reversedRef.current ? -1 : 1
      slideRef.current += (e.clientY - lastClientY.current) * SLIDE_SENS * dir
      lastClientY.current = e.clientY
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyA') keyA.current = true
      if (e.code === 'KeyD') keyD.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA') keyA.current = false
      if (e.code === 'KeyD') keyD.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    // ── Player spin — torque-based rotation with damping + spring to neutral ─
    const TORQUE      = 300  // angular acceleration while key held (rad/s²)
    const ANG_DAMP    = 10   // velocity damping (simulates air/friction resistance)
    const SPRING      = 220  // spring stiffness pulling back to neutral when released
    const SPIN_MAX    = Math.PI / 2

    const dir = reversedRef.current ? -1 : 1
    if (keyA.current) angVel.current -= dir * TORQUE * delta
    if (keyD.current) angVel.current += dir * TORQUE * delta
    if (!keyA.current && !keyD.current) {
      // Spring force pulls toward neutral
      angVel.current -= SPRING * spinRef.current * delta
    }
    // Angular damping
    angVel.current *= Math.max(0, 1 - ANG_DAMP * delta)
    // Integrate
    spinRef.current += angVel.current * delta
    // Hard stop at limits — kill velocity in the hitting direction
    if (spinRef.current > SPIN_MAX) {
      spinRef.current = SPIN_MAX
      angVel.current = Math.min(0, angVel.current)
    } else if (spinRef.current < -SPIN_MAX) {
      spinRef.current = -SPIN_MAX
      angVel.current = Math.max(0, angVel.current)
    }
    playerControl.current.slide = slideRef.current
    playerControl.current.spin  = spinRef.current

    // ── Apply AI (rule-based) ─────────────────────────────────────────────
    let aiIdx = 0
    for (let ri = 0; ri < RODS.length; ri++) {
      if (RODS[ri].team !== AI_TEAM) continue
      const state = aiState.current[aiIdx]
      tickRuleBasedAI(state, RODS[ri], delta)
      aiControls[aiIdx].current.slide = state.slide
      aiControls[aiIdx].current.spin  = state.spin
      aiIdx++
    }
  })

  return (
    <group>
      {RODS.map((rod, i) => {
        const aiIdx = ROD_AI_IDX[i]
        const controlRef = rod.team === PLAYER_TEAM ? playerControl : aiControls[aiIdx]
        return <RodAssembly key={i} rodDef={rod} controlRef={controlRef} />
      })}
    </group>
  )
}
