import { RigidBody } from '@react-three/rapier'

// Table dimensions
export const TABLE = {
  width: 3.5,    // X — side to side
  length: 5.0,   // Z — goal to goal
  wallH: 0.5,
  wallT: 0.15,
  floorY: 0,
  goalW: 1.2,    // mouth width
  goalDepth: 0.6,
  goalH: 0.45,
}

export function Table() {
  const hw = TABLE.width / 2
  const hl = TABLE.length / 2
  const wt = TABLE.wallT

  return (
    <group>
      {/* Playing surface */}
      <RigidBody type="fixed" friction={0.5} restitution={0.3}>
        <mesh receiveShadow position={[0, -0.05, 0]}>
          <boxGeometry args={[TABLE.width, 0.1, TABLE.length]} />
          <meshStandardMaterial color="#2d6a2d" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Side wall — negative X */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow receiveShadow position={[-hw - wt / 2, TABLE.wallH / 2, 0]}>
          <boxGeometry args={[wt, TABLE.wallH, TABLE.length]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Side wall — positive X */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow receiveShadow position={[hw + wt / 2, TABLE.wallH / 2, 0]}>
          <boxGeometry args={[wt, TABLE.wallH, TABLE.length]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* End walls (left/right of goal mouth) — negative Z side */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[-(TABLE.goalW / 2 + (hw - TABLE.goalW / 2) / 2), TABLE.wallH / 2, -hl - wt / 2]}>
          <boxGeometry args={[hw - TABLE.goalW / 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[(TABLE.goalW / 2 + (hw - TABLE.goalW / 2) / 2), TABLE.wallH / 2, -hl - wt / 2]}>
          <boxGeometry args={[hw - TABLE.goalW / 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* End walls — positive Z side */}
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[-(TABLE.goalW / 2 + (hw - TABLE.goalW / 2) / 2), TABLE.wallH / 2, hl + wt / 2]}>
          <boxGeometry args={[hw - TABLE.goalW / 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" restitution={0.5} friction={0.2}>
        <mesh castShadow position={[(TABLE.goalW / 2 + (hw - TABLE.goalW / 2) / 2), TABLE.wallH / 2, hl + wt / 2]}>
          <boxGeometry args={[hw - TABLE.goalW / 2, TABLE.wallH, wt]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Goal boxes — visual only, open mouth facing inward */}
      <GoalBox position={[0, 0, -hl]} color="#1a4a8a" />
      <GoalBox position={[0, 0, hl]} color="#8a1a1a" />

      {/* Corner caps */}
      <mesh position={[-hw - wt / 2, TABLE.wallH / 2, -hl - wt / 2]}>
        <boxGeometry args={[wt, TABLE.wallH, wt]} />
        <meshStandardMaterial color="#5C2E00" />
      </mesh>
      <mesh position={[hw + wt / 2, TABLE.wallH / 2, -hl - wt / 2]}>
        <boxGeometry args={[wt, TABLE.wallH, wt]} />
        <meshStandardMaterial color="#5C2E00" />
      </mesh>
      <mesh position={[-hw - wt / 2, TABLE.wallH / 2, hl + wt / 2]}>
        <boxGeometry args={[wt, TABLE.wallH, wt]} />
        <meshStandardMaterial color="#5C2E00" />
      </mesh>
      <mesh position={[hw + wt / 2, TABLE.wallH / 2, hl + wt / 2]}>
        <boxGeometry args={[wt, TABLE.wallH, wt]} />
        <meshStandardMaterial color="#5C2E00" />
      </mesh>

      {/* Center line */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TABLE.width, 0.04]} />
        <meshStandardMaterial color="#fff" opacity={0.3} transparent />
      </mesh>
      {/* Center circle */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.52, 32]} />
        <meshStandardMaterial color="#fff" opacity={0.3} transparent />
      </mesh>
    </group>
  )
}

function GoalBox({ position, color }: { position: [number, number, number]; color: string }) {
  const gw = TABLE.goalW
  const gd = TABLE.goalDepth
  const gh = TABLE.goalH
  const wt = TABLE.wallT
  const sign = position[2] < 0 ? -1 : 1

  return (
    <group position={position}>
      {/* floor */}
      <mesh position={[0, -gh / 2, sign * gd / 2]}>
        <boxGeometry args={[gw, wt, gd]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, gh / 2, sign * (gd + wt / 2)]}>
        <boxGeometry args={[gw, gh + wt, wt]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* left side */}
      <mesh position={[-gw / 2 - wt / 2, gh / 2, sign * gd / 2]}>
        <boxGeometry args={[wt, gh + wt, gd]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* right side */}
      <mesh position={[gw / 2 + wt / 2, gh / 2, sign * gd / 2]}>
        <boxGeometry args={[wt, gh + wt, gd]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* top bar */}
      <mesh position={[0, gh + wt / 2, sign * gd / 2]}>
        <boxGeometry args={[gw + wt * 2, wt, gd]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}
