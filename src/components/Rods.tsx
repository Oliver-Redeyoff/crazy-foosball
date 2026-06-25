import { useRef, useEffect, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CuboidCollider, ConvexHullCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { TABLE } from './Table'
import { ballPos, ballVel } from '../ballState'
import { useGameStore, type Difficulty } from '../store'
import { touchControls } from '../touchState'

// Octagonal foot — π/8 offset aligns a flat face with ±Z so front-on = straight kick,
// 45°-angled adjacent faces give clean diagonal deflection on side contact.
const OCT_R = 0.14   // circumradius in XZ plane
const OCT_H = 0.1    // half-height in Y
const OCT_FOOT_VERTS = (() => {
  const v: number[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8  // offset so flat face faces ±Z
    v.push(OCT_R * Math.cos(a), OCT_H,  OCT_R * Math.sin(a))
    v.push(OCT_R * Math.cos(a), -OCT_H, OCT_R * Math.sin(a))
  }
  return new Float32Array(v)
})()

const SPIN_LIMIT   = Math.PI * 0.55
const SLIDE_SENS   = 0.008
const MAX_SPIN_VEL = 10.0
const RETURN_SPEED = 5.0
const ROD_Y = 0.84

// Interleaved layout: Red GK · Blue FWD · Red MID · Blue MID · Red FWD · Blue GK
// Red attacks +Z, Blue attacks -Z
const PADDED_LENGTH    = TABLE.length - 1   // 2.5
// const S     = 0.6
// const GK_Z  = HL - S             // 1.9
// const MID_Z = (HL + S / 2) / 2  // 1.4
// const FWD_Z = S                  // 0.6

const RODS = [
  { z: PADDED_LENGTH * 0/5 - PADDED_LENGTH / 2,  team: 'right' as const, count: 1 }, // Red GK  (defends −Z goal)
  { z: PADDED_LENGTH * 1/5 - PADDED_LENGTH / 2 , team: 'left'  as const, count: 2 }, // Blue FWD
  { z: PADDED_LENGTH * 2/5 - PADDED_LENGTH / 2, team: 'right' as const, count: 3 }, // Red MID
  { z: PADDED_LENGTH * 3/5 - PADDED_LENGTH / 2, team: 'left'  as const, count: 3 }, // Blue MID
  { z: PADDED_LENGTH * 4/5 - PADDED_LENGTH / 2, team: 'right' as const, count: 2 }, // Red FWD
  { z: PADDED_LENGTH * 5/5 - PADDED_LENGTH / 2,  team: 'left'  as const, count: 1 }, // Blue GK (defends +Z goal)
]

const PLAYER_TEAM = 'left'  as const
const AI_TEAM     = 'right' as const

// Map each RODS index → AI rod index (0,1,2) or -1 if player rod
const ROD_AI_IDX = (() => {
  let ai = 0
  return RODS.map(r => r.team === AI_TEAM ? ai++ : -1)
})()
// ROD_AI_IDX = [0, -1, 1, -1, 2, -1]

// Map each RODS index → player rod index (0,1,2) or -1 if AI rod
const ROD_PLAYER_IDX = (() => {
  let p = 0
  return RODS.map(r => r.team === PLAYER_TEAM ? p++ : -1)
})()
// ROD_PLAYER_IDX = [-1, 0, -1, 1, -1, 2]

// Rule-based AI tuning — base values (medium difficulty)
const AI_SLIDE_GK   = 2.5
const AI_SLIDE_FWD  = 4.5
const AI_SLIDE_MID  = 3.5
const AI_KICK_Z     = 0.45
const AI_KICK_X     = 0.32

const DIFF_CFG: Record<Difficulty, { speedMul: number; kickDelay: number; predWindow: number; noise: number }> = {
  easy:   { speedMul: 0.38, kickDelay: 0.55, predWindow: 0.15, noise: 0.45 },
  medium: { speedMul: 1.0,  kickDelay: 0.25, predWindow: 0.60, noise: 0    },
  hard:   { speedMul: 1.85, kickDelay: 0.08, predWindow: 1.10, noise: 0    },
}

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
type Phase = 'idle' | 'firing' | 'returning' | 'scoop-back' | 'scoop-slide' | 'scoop-kick'

interface AiRodState {
  slide: number
  spin: number
  phase: Phase
  targetSpin: number
  idleTimer: number
}

// ─── Kick state machine (one AI rod) ─────────────────────────────────────────

function tickKickWithDelay(state: AiRodState, trigger: boolean, delta: number, delay: number) {
  switch (state.phase) {
    case 'idle':
      state.idleTimer += delta
      if (state.idleTimer >= delay && trigger) {
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

// ─── Scoop state machine — rotate back → slide over ball → kick forward ──────

function tickScoopKick(state: AiRodState, targetSlide: number, speed: number, delta: number) {
  switch (state.phase) {
    case 'scoop-back':
      state.spin += MAX_SPIN_VEL * delta
      if (state.spin >= SPIN_LIMIT) {
        state.spin = SPIN_LIMIT
        state.phase = 'scoop-slide'
      }
      break
    case 'scoop-slide':
      state.spin = SPIN_LIMIT
      state.slide = THREE.MathUtils.lerp(state.slide, targetSlide, speed * delta)
      if (Math.abs(state.slide - targetSlide) < 0.06) state.phase = 'scoop-kick'
      break
    case 'scoop-kick':
      state.spin -= MAX_SPIN_VEL * delta
      if (state.spin <= -SPIN_LIMIT) {
        state.spin = -SPIN_LIMIT
        state.phase = 'returning'
      }
      break
  }
}

// ─── Rule-based AI ───────────────────────────────────────────────────────────

function tickRuleBasedAI(state: AiRodState, rodDef: typeof RODS[0], delta: number, difficulty: Difficulty) {
  const cfg   = DIFF_CFG[difficulty]
  const bx    = ballPos.x
  const bz    = ballPos.z
  const lim   = slideLimit(rodDef.count)
  const isGK  = rodDef.count === 1
  const baseSpeed = isGK ? AI_SLIDE_GK : rodDef.count === 3 ? AI_SLIDE_MID : AI_SLIDE_FWD
  const speed = baseSpeed * cfg.speedMul

  const vz = ballVel.z
  const dz = rodDef.z - bz
  const offsets = playerXOffsets(rodDef.count)

  // ── Scoop sequence: ball slightly behind → back → slide → kick ───────────
  if (state.phase === 'scoop-back' || state.phase === 'scoop-slide' || state.phase === 'scoop-kick') {
    let bestOff = offsets[0], minDist = Infinity
    for (const off of offsets) {
      const d = Math.abs(bx - (state.slide + off))
      if (d < minDist) { minDist = d; bestOff = off }
    }
    const targetSlide = Math.max(-lim, Math.min(lim, bx - bestOff))
    tickScoopKick(state, targetSlide, speed * 1.5, delta)
    return
  }

  const ballInFront       = bz >= rodDef.z - 0.12
  const ballSlightlyBehind = !ballInFront && bz > rodDef.z - 0.5

  let target: number
  if (!ballInFront) {
    target = Math.max(-lim, Math.min(lim, -bx))
  } else {
    let predictedX = bx
    if (cfg.predWindow > 0 && Math.abs(vz) > 0.08) {
      const t = dz / vz
      if (t > 0 && t < cfg.predWindow) predictedX = bx + ballVel.x * t
    }
    // On easy, blur the predicted position with noise
    if (cfg.noise > 0) predictedX += (Math.random() - 0.5) * cfg.noise * 2

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
  const aligned    = offsets.some(o => Math.abs(state.slide + o - bx) < AI_KICK_X)

  // Trigger scoop when ball is slightly behind this rod
  if (state.phase === 'idle' && ballSlightlyBehind) {
    state.phase = 'scoop-back'
    state.idleTimer = 0
    return
  }

  tickKickWithDelay(state, ballInFront && !movingAway && Math.abs(bz - rodDef.z) < AI_KICK_Z && aligned, delta, cfg.kickDelay)
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
  const shorts  = rodDef.team === 'left' ? '#1a3a70' : '#701a1a'
  const offsets = playerXOffsets(rodDef.count)
  // Red attacks +Z, Blue attacks -Z — face toward the opposing goal
  const fz      = rodDef.team === 'right' ? 1 : -1

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
          {/* Physics colliders (unchanged) */}
          <CuboidCollider args={[0.14, 0.27, 0.04]} position={[0, -0.26, 0]} />
          <ConvexHullCollider args={[OCT_FOOT_VERTS]} position={[0, -0.80, 0]} />

          {/* Jersey body */}
          <mesh castShadow position={[0, -0.26, 0]}>
            <boxGeometry args={[0.28, 0.54, 0.08]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          {/* Chest stripe */}
          <mesh position={[0, -0.14, fz * 0.041]}>
            <boxGeometry args={[0.20, 0.06, 0.002]} />
            <meshStandardMaterial color={accent} roughness={0.3} />
          </mesh>
          {/* Collar / neck */}
          <mesh castShadow position={[0, 0.04, 0]}>
            <boxGeometry args={[0.12, 0.07, 0.08]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
          </mesh>

          {/* Head */}
          <mesh castShadow position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
          </mesh>
          {/* Hair */}
          {/* <mesh castShadow position={[0, 0.325, fz * -0.02]}>
            <boxGeometry args={[0.25, 0.09, 0.21]} />
            <meshStandardMaterial color="#3d2008" roughness={0.9} />
          </mesh> */}
          {/* Eyes */}
          {/* <mesh position={[-0.043, 0.235, fz * 0.122]}>
            <sphereGeometry args={[0.023, 6, 6]} />
            <meshStandardMaterial color="#111" roughness={0.1} />
          </mesh>
          <mesh position={[0.043, 0.235, fz * 0.122]}>
            <sphereGeometry args={[0.023, 6, 6]} />
            <meshStandardMaterial color="#111" roughness={0.1} />
          </mesh> */}

          {/* Shorts */}
          <mesh castShadow position={[0, -0.565, 0]}>
            <boxGeometry args={[0.27, 0.10, 0.10]} />
            <meshStandardMaterial color={shorts} roughness={0.6} />
          </mesh>

          {/* Left leg (skin) */}
          <mesh castShadow position={[-0.065, -0.70, 0]}>
            <boxGeometry args={[0.09, 0.18, 0.08]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
          </mesh>
          {/* Right leg (skin) */}
          <mesh castShadow position={[0.065, -0.70, 0]}>
            <boxGeometry args={[0.09, 0.18, 0.08]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
          </mesh>

          {/* Octagonal foot — flat ±Z faces for straight kick, 45° faces for diagonal */}
          <mesh castShadow position={[0, -0.80, 0]}>
            <cylinderGeometry args={[OCT_R, OCT_R, OCT_H * 2, 8, 1, false, Math.PI / 8]} />
            <meshStandardMaterial color="#111" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

// ─── Rods ─────────────────────────────────────────────────────────────────────

export function Rods() {
  // One independent control + slide ref per player rod (FWD=0, MID=1, GK=2)
  const playerControl0 = useRef<Control>({ slide: 0, spin: 0 })
  const playerControl1 = useRef<Control>({ slide: 0, spin: 0 })
  const playerControl2 = useRef<Control>({ slide: 0, spin: 0 })
  const playerControls = [playerControl0, playerControl1, playerControl2]

  const playerSlide0 = useRef(0)
  const playerSlide1 = useRef(0)
  const playerSlide2 = useRef(0)
  const playerSlides = [playerSlide0, playerSlide1, playerSlide2]

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
  const difficulty   = useGameStore((s) => s.difficulty)
  const resetKey     = useGameStore((s) => s.resetKey)
  const reversedRef    = useRef(false)
  const difficultyRef  = useRef<Difficulty>('medium')

  useEffect(() => { reversedRef.current   = currentTwist === 'reverseControls' }, [currentTwist])
  useEffect(() => { difficultyRef.current = difficulty }, [difficulty])

  // Shared player spin state (all player rods rotate together)
  const lastClientY  = useRef(-1)
  const lastClientX  = useRef(-1)
  const lastTouchPos = useRef({ x: -1, y: -1 })
  const spinRef      = useRef(0)
  const angVel       = useRef(0)
  const keyA         = useRef(false)
  const keyD         = useRef(false)

  // Reset all rod positions and AI state when a new game starts.
  useEffect(() => {
    playerSlides.forEach(s => { s.current = 0 })
    spinRef.current = 0
    angVel.current  = 0
    aiState.current.forEach(s => {
      s.slide = 0; s.spin = 0; s.phase = 'idle'; s.targetSpin = 0; s.idleTimer = 0
    })
  }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // ── Mouse drag: horizontal in portrait, vertical in landscape ────────────
    const onMouseMove = (e: MouseEvent) => {
      const rev = reversedRef.current ? -1 : 1
      if (touchControls.isPortrait) {
        if (lastClientX.current < 0) { lastClientX.current = e.clientX; return }
        const delta = (e.clientX - lastClientX.current) * SLIDE_SENS * rev
        playerSlides.forEach(s => { s.current += delta })
        lastClientX.current = e.clientX
      } else {
        if (lastClientY.current < 0) { lastClientY.current = e.clientY; return }
        const delta = (e.clientY - lastClientY.current) * SLIDE_SENS * rev
        playerSlides.forEach(s => { s.current += delta })
        lastClientY.current = e.clientY
      }
    }

    // ── Touch drag: X in portrait, Y in landscape ─────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      lastTouchPos.current = { x: t.clientX, y: t.clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (lastTouchPos.current.x < 0) return
      const rev = reversedRef.current ? -1 : 1
      const delta = touchControls.isPortrait
        ? (t.clientX - lastTouchPos.current.x) * SLIDE_SENS * rev
        : (t.clientY - lastTouchPos.current.y) * SLIDE_SENS * rev
      playerSlides.forEach(s => { s.current += delta })
      lastTouchPos.current = { x: t.clientX, y: t.clientY }
    }
    const onTouchEnd = () => { lastTouchPos.current = { x: -1, y: -1 } }

    // ── Keyboard spin ─────────────────────────────────────────────────────
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
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    // ── Player spin — torque-based rotation with damping + spring to neutral ─
    const TORQUE   = 300
    const ANG_DAMP = 10
    const SPRING   = 220
    const SPIN_MAX = Math.PI / 2

    const dir     = reversedRef.current ? -1 : 1
    const doBack  = keyA.current || touchControls.spinBack
    const doFwd   = keyD.current || touchControls.spinFwd
    if (doBack) angVel.current -= dir * TORQUE * delta
    if (doFwd)  angVel.current += dir * TORQUE * delta
    if (!doBack && !doFwd) {
      angVel.current -= SPRING * spinRef.current * delta
    }
    angVel.current *= Math.max(0, 1 - ANG_DAMP * delta)
    spinRef.current += angVel.current * delta
    if (spinRef.current > SPIN_MAX) {
      spinRef.current = SPIN_MAX
      angVel.current = Math.min(0, angVel.current)
    } else if (spinRef.current < -SPIN_MAX) {
      spinRef.current = -SPIN_MAX
      angVel.current = Math.max(0, angVel.current)
    }

    // ── Update each player rod independently, clamped to its own limit ────
    let pi = 0
    for (let ri = 0; ri < RODS.length; ri++) {
      if (RODS[ri].team !== PLAYER_TEAM) continue
      const lim = slideLimit(RODS[ri].count)
      playerSlides[pi].current = Math.max(-lim, Math.min(lim, playerSlides[pi].current))
      playerControls[pi].current.slide = playerSlides[pi].current
      playerControls[pi].current.spin  = spinRef.current
      pi++
    }

    // ── Apply AI (rule-based) ─────────────────────────────────────────────
    let aiIdx = 0
    for (let ri = 0; ri < RODS.length; ri++) {
      if (RODS[ri].team !== AI_TEAM) continue
      const state = aiState.current[aiIdx]
      tickRuleBasedAI(state, RODS[ri], delta, difficultyRef.current)
      aiControls[aiIdx].current.slide = state.slide
      aiControls[aiIdx].current.spin  = state.spin
      aiIdx++
    }
  })

  return (
    <group>
      {RODS.map((rod, i) => {
        const aiIdx = ROD_AI_IDX[i]
        const pi    = ROD_PLAYER_IDX[i]
        const controlRef = rod.team === PLAYER_TEAM ? playerControls[pi] : aiControls[aiIdx]
        return <RodAssembly key={i} rodDef={rod} controlRef={controlRef} />
      })}
    </group>
  )
}
