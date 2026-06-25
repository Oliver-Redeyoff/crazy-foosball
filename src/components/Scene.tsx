import { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics, useRapier } from '@react-three/rapier'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { Table } from './Table'
import { Ball } from './Ball'
import { Rods } from './Rods'
import { GoalSensors } from './GoalSensors'
import { useGameStore } from '../store'
import { ballCount as getBallCount } from '../twists'

const CAM = {
  landscape: { pos: [4, 8, 0] as [number, number, number], fov: 50, target: new THREE.Vector3(0, 0.3, 0) },
  portrait:  { pos: [0, 11, 5] as [number, number, number], fov: 58, target: new THREE.Vector3(0, 0,   0) },
}

// Sets camera position + FOV on mount and whenever orientation changes.
function CameraController({ isPortrait }: { isPortrait: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    const cfg = isPortrait ? CAM.portrait : CAM.landscape
    camera.position.set(...cfg.pos)
    camera.lookAt(cfg.target)
    ;(camera as THREE.PerspectiveCamera).fov = cfg.fov
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  }, [isPortrait, camera])
  return null
}

function EarthquakeCamera({ isPortrait }: { isPortrait: boolean }) {
  const currentTwist = useGameStore((s) => s.currentTwist)
  const offset = useRef({ x: 0, y: 0, z: 0 })
  const target = useRef({ x: 0, y: 0, z: 0 })
  const timer  = useRef(0)

  useFrame(({ camera }, delta) => {
    const base = isPortrait ? CAM.portrait.pos : CAM.landscape.pos

    if (currentTwist === 'earthquake') {
      timer.current += delta
      if (timer.current > 0.07) {
        timer.current = 0
        target.current.x = (Math.random() - 0.5) * 0.28
        target.current.y = (Math.random() - 0.5) * 0.14
        target.current.z = (Math.random() - 0.5) * 0.28
      }
      const t = Math.min(1, 12 * delta)
      offset.current.x += (target.current.x - offset.current.x) * t
      offset.current.y += (target.current.y - offset.current.y) * t
      offset.current.z += (target.current.z - offset.current.z) * t
    } else {
      offset.current.x *= 0.82
      offset.current.y *= 0.82
      offset.current.z *= 0.82
    }
    camera.position.set(
      base[0] + offset.current.x,
      base[1] + offset.current.y,
      base[2] + offset.current.z,
    )
  })

  return null
}

function GravityController() {
  const currentTwist = useGameStore((s) => s.currentTwist)
  const { world } = useRapier()

  useEffect(() => {
    world.gravity.y = currentTwist === 'lowGravity' ? -2.5 : -9.81
  }, [currentTwist, world])

  return null
}

export function Scene({ isPortrait }: { isPortrait: boolean }) {
  const currentTwist = useGameStore((s) => s.currentTwist)
  const count = getBallCount(currentTwist)

  return (
    <Canvas
      shadows
      camera={{ position: [4, 8, 0], fov: 50, near: 0.1, far: 100 }}
      style={{ background: '#1a1a2e' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[4, 8, 4]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[-4, 6, -4]} intensity={0.5} color="#4466ff" />
      <pointLight position={[4, 6, 4]} intensity={0.5} color="#ff4444" />

      <Environment preset="warehouse" />

      <CameraController isPortrait={isPortrait} />
      <EarthquakeCamera isPortrait={isPortrait} />

      <Physics gravity={[0, -9.81, 0]} debug={false}>
        <GravityController />
        <Table />
        {Array.from({ length: count }, (_, i) => (
          <Ball key={`ball-${currentTwist}-${i}`} index={i} />
        ))}
        <Rods />
        <GoalSensors key={`gs-${currentTwist}`} />
      </Physics>

      <OrbitControls enabled={false} target={[0, 0.3, 0]} />
    </Canvas>
  )
}
