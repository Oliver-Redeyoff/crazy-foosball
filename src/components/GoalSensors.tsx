import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useGameStore } from '../store'
import { TABLE } from './Table'

const HL = TABLE.length / 2

export function GoalSensors() {
  const incrementScore = useGameStore((s) => s.incrementScore)
  const phase = useGameStore((s) => s.phase)

  return (
    <>
      {/* Sensor behind negative-Z goal (scores for right/red team) */}
      <RigidBody type="fixed" sensor position={[0, 0.15, -HL - TABLE.goalDepth * 0.6]}>
        <CuboidCollider
          args={[TABLE.goalW / 2, TABLE.goalH / 2, TABLE.goalDepth / 2]}
          onIntersectionEnter={({ other }) => {
            if (phase === 'playing' && other.rigidBodyObject?.name === 'ball') {
              incrementScore('right')
            }
          }}
        />
      </RigidBody>

      {/* Sensor behind positive-Z goal (scores for left/blue team) */}
      <RigidBody type="fixed" sensor position={[0, 0.15, HL + TABLE.goalDepth * 0.6]}>
        <CuboidCollider
          args={[TABLE.goalW / 2, TABLE.goalH / 2, TABLE.goalDepth / 2]}
          onIntersectionEnter={({ other }) => {
            if (phase === 'playing' && other.rigidBodyObject?.name === 'ball') {
              incrementScore('left')
            }
          }}
        />
      </RigidBody>
    </>
  )
}
