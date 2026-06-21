import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useGameStore } from '../store'
import { TABLE } from './Table'
import { goalScale as getGoalScale } from '../twists'

const HL          = TABLE.length / 2
const BALL_RADIUS = 0.20

export function GoalSensors() {
  const incrementScore = useGameStore((s) => s.incrementScore)
  const phase          = useGameStore((s) => s.phase)
  const currentTwist   = useGameStore((s) => s.currentTwist)

  const gScale = getGoalScale(currentTwist)
  const goalW  = TABLE.goalW * gScale
  const goalH  = TABLE.goalH * gScale

  // Place sensor deep inside the goal box so the ball must fully cross the goal
  // line before triggering. Rapier sphere-box detection fires when the ball
  // surface touches the box, so we keep the sensor front face at least
  // BALL_RADIUS past the goal opening. Sensor is also narrowed slightly in X
  // so a ball grazing the post from outside doesn't count.
  const sDepthCenter = TABLE.goalDepth * 0.70  // sensor centre offset from goal line
  const sDepthHalf   = TABLE.goalDepth * 0.28  // sensor half-extent in Z
  //   → sensor front face = sDepthCenter - sDepthHalf = 0.42 * goalDepth past goal line
  //   → sphere triggers when ball centre is (0.42*goalDepth - BALL_RADIUS) past line
  const sXHalf = goalW / 2 - BALL_RADIUS - 0.05  // 5 cm margin inside each post

  return (
    <>
      <RigidBody type="fixed" sensor position={[0, goalH / 2, -(HL + sDepthCenter)]}>
        <CuboidCollider
          args={[sXHalf, goalH / 2, sDepthHalf]}
          onIntersectionEnter={({ other }) => {
            if (phase === 'playing' && other.rigidBodyObject?.name === 'ball')
              incrementScore('right')
          }}
        />
      </RigidBody>

      <RigidBody type="fixed" sensor position={[0, goalH / 2, HL + sDepthCenter]}>
        <CuboidCollider
          args={[sXHalf, goalH / 2, sDepthHalf]}
          onIntersectionEnter={({ other }) => {
            if (phase === 'playing' && other.rigidBodyObject?.name === 'ball')
              incrementScore('left')
          }}
        />
      </RigidBody>
    </>
  )
}
