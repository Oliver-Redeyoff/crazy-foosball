import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useGameStore } from '../store'
import { TABLE } from './Table'
import { goalScale as getGoalScale } from '../twists'

const HL = TABLE.length / 2

export function GoalSensors() {
  const incrementScore = useGameStore((s) => s.incrementScore)
  const phase          = useGameStore((s) => s.phase)
  const currentTwist   = useGameStore((s) => s.currentTwist)

  const gScale = getGoalScale(currentTwist)
  const goalW  = TABLE.goalW * gScale
  const goalH  = TABLE.goalH * gScale

  return (
    <>
      <RigidBody type="fixed" sensor position={[0, goalH / 2, -HL - TABLE.goalDepth * 0.6]}>
        <CuboidCollider
          args={[goalW / 2, goalH / 2, TABLE.goalDepth / 2]}
          onIntersectionEnter={({ other }) => {
            if (phase === 'playing' && other.rigidBodyObject?.name === 'ball')
              incrementScore('right')
          }}
        />
      </RigidBody>

      <RigidBody type="fixed" sensor position={[0, goalH / 2, HL + TABLE.goalDepth * 0.6]}>
        <CuboidCollider
          args={[goalW / 2, goalH / 2, TABLE.goalDepth / 2]}
          onIntersectionEnter={({ other }) => {
            if (phase === 'playing' && other.rigidBodyObject?.name === 'ball')
              incrementScore('left')
          }}
        />
      </RigidBody>
    </>
  )
}
