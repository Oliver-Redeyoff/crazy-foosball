import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { OrbitControls, Environment } from '@react-three/drei'
import { Table } from './Table'
import { Ball } from './Ball'
import { Rods } from './Rods'
import { GoalSensors } from './GoalSensors'
export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [4, 6.2, 0], fov: 50, near: 0.1, far: 100 }}
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

      <Physics gravity={[0, -9.81, 0]} debug={false}>
        <Table />
        <Ball />
        <Rods />
        <GoalSensors />
      </Physics>

      <OrbitControls enabled={false} target={[0, 0.3, 0]} />
    </Canvas>
  )
}
