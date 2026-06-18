import { useEffect, useRef } from 'react'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store'

export const BALL_START: [number, number, number] = [0, 0.3, 0]
const BALL_RADIUS = 0.24

export function Ball() {
  const rb = useRef<RapierRigidBody>(null)
  const phase = useGameStore((s) => s.phase)
  const resetBall = useGameStore((s) => s.resetBall)

  // Reset ball to center when phase transitions to 'scored'
  useEffect(() => {
    if (phase === 'scored' && rb.current) {
      const timeout = setTimeout(() => {
        if (!rb.current) return
        rb.current.setTranslation({ x: 0, y: 0.3, z: 0 }, true)
        rb.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
        rb.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
        // Give a small random kick
        const angle = Math.random() * Math.PI * 2
        rb.current.applyImpulse({ x: Math.cos(angle) * 0.06, y: 0, z: Math.sin(angle) * 0.06 }, true)
        resetBall()
      }, 1500)
      return () => clearTimeout(timeout)
    }
  }, [phase, resetBall])

  // Keep ball from flying too high or getting stuck
  useFrame(() => {
    if (!rb.current) return
    const pos = rb.current.translation()
    if (pos.y > 2) {
      rb.current.setTranslation({ x: pos.x, y: 0.3, z: pos.z }, true)
      rb.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  })

  return (
    <RigidBody
      ref={rb}
      position={BALL_START}
      restitution={0.65}
      friction={0.4}
      linearDamping={0.3}
      angularDamping={0.3}
      colliders="ball"
      name="ball"
    >
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
        <meshStandardMaterial color="#f5e642" roughness={0.3} metalness={0.1} />
      </mesh>
    </RigidBody>
  )
}
