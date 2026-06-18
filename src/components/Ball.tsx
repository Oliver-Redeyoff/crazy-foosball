import { useEffect, useRef } from 'react'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store'
import { ballPos, ballVel } from '../ballState'

const BASE_RADIUS = 0.20

const BALL_STARTS: [number, number, number][] = [
  [0,    0.3, 0   ],
  [0.5,  0.5, 0.5 ],
  [-0.5, 0.5, -0.5],
]

export const BALL_START = BALL_STARTS[0]

export function Ball({ index = 0 }: { index?: number }) {
  const rb           = useRef<RapierRigidBody>(null)
  const phase        = useGameStore((s) => s.phase)
  const resetBall    = useGameStore((s) => s.resetBall)
  const currentTwist = useGameStore((s) => s.currentTwist)


  const isIce  = currentTwist === 'iceRink'
  const radius = BASE_RADIUS
  const start  = BALL_STARTS[index] ?? BALL_STARTS[0]

  useEffect(() => {
    if (phase !== 'scored' || !rb.current) return
    const t = setTimeout(() => {
      if (!rb.current) return
      rb.current.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
      rb.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      const angle = Math.random() * Math.PI * 2
      rb.current.applyImpulse({ x: Math.cos(angle) * 0.06, y: 0, z: Math.sin(angle) * 0.06 }, true)
      // Only ball 0 advances the game phase so resetBall is called exactly once
      if (index === 0) resetBall()
    }, 1500)
    return () => clearTimeout(t)
  }, [phase, resetBall, index, start])

  const prevPos    = useRef({ x: 0, y: 0, z: 0 })
  const quakeTimer = useRef(0)
  const stuckTimer = useRef(0)

  useFrame((_, delta) => {
    if (!rb.current) return
    const pos = rb.current.translation()

    // Ball 0 is the "primary" ball — drives AI tracking
    if (index === 0 && delta > 0) {
      ballVel.x = (pos.x - prevPos.current.x) / delta
      ballVel.z = (pos.z - prevPos.current.z) / delta
      ballPos.x = pos.x; ballPos.y = pos.y; ballPos.z = pos.z
    }
    prevPos.current.x = pos.x
    prevPos.current.y = pos.y
    prevPos.current.z = pos.z

    // Stuck detector — if ball barely moves for 1 s during play, kick it free
    if (phase === 'playing') {
      const vel   = rb.current.linvel()
      const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2)
      if (speed < 0.08) {
        stuckTimer.current += delta
        if (stuckTimer.current > 1.0) {
          stuckTimer.current = 0
          const angle = Math.random() * Math.PI * 2
          rb.current.applyImpulse(
            { x: Math.cos(angle) * 0.25, y: 0.04, z: Math.sin(angle) * 0.25 },
            true,
          )
        }
      } else {
        stuckTimer.current = 0
      }
    }

    // Earthquake: random impulses every ~0.3 s on all balls
    if (currentTwist === 'earthquake') {
      quakeTimer.current += delta
      if (quakeTimer.current >= 0.3) {
        quakeTimer.current = 0
        rb.current.applyImpulse({
          x: (Math.random() - 0.5) * 0.18,
          y: 0,
          z: (Math.random() - 0.5) * 0.18,
        }, true)
      }
    }
  })

  return (
    <RigidBody
      ref={rb}
      position={start}
      restitution={isIce ? 0.6 : 0.35}
      friction={isIce ? 0.0 : 0.08}
      linearDamping={isIce ? 0.01 : 0.15}
      angularDamping={isIce ? 0.01 : 0.12}
      ccd
      colliders="ball"
      name="ball"
    >
      <mesh castShadow>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color="#f5e642" roughness={0.3} metalness={0.1} />
      </mesh>
    </RigidBody>
  )
}
