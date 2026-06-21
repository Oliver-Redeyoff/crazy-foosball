import { useEffect, useRef } from 'react'
import { RigidBody, RapierRigidBody, BallCollider } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { ballPos, ballVel } from '../ballState'

const BASE_RADIUS = 0.20

const BALL_STARTS: [number, number, number][] = [
  [0,    0.3, 0   ],
  [0.5,  0.5, 0.5 ],
  [-0.5, 0.5, -0.5],
]

export const BALL_START = BALL_STARTS[0]

// ─── Truncated-icosahedron (soccer ball) geometry ────────────────────────────
// Algorithmically truncates an icosahedron: each of the 30 edges becomes 2
// vertices (1/3 and 2/3 along the edge), yielding 60 vertices, 12 pentagons
// (black), and 20 hexagons (white).  Vertices are projected onto a sphere.

function makeSoccerBallGeometry(r: number): THREE.BufferGeometry {
  type V3 = [number, number, number]
  const phi = (1 + Math.sqrt(5)) / 2

  // 12 icosahedron vertices
  const IV: V3[] = [
    [0, 1, phi],  [0, -1, phi],  [0, 1, -phi],  [0, -1, -phi],
    [1, phi, 0],  [-1, phi, 0],  [1, -phi, 0],  [-1, -phi, 0],
    [phi, 0, 1],  [-phi, 0, 1],  [phi, 0, -1],  [-phi, 0, -1],
  ]

  // Build edge list and per-vertex neighbour lists
  const eIdx = new Map<string, number>()
  const edges: [number, number][] = []
  const nbrs: number[][] = Array.from({ length: 12 }, () => [])
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
    const d2 = (IV[i][0]-IV[j][0])**2+(IV[i][1]-IV[j][1])**2+(IV[i][2]-IV[j][2])**2
    if (Math.abs(d2 - 4) < 0.01) {
      eIdx.set(`${i},${j}`, edges.length)
      edges.push([i, j])
      nbrs[i].push(j); nbrs[j].push(i)
    }
  }

  // 60 truncated vertices: TV[2e] close to edges[e][0], TV[2e+1] close to edges[e][1]
  const TV: V3[] = []
  for (const [i, j] of edges) {
    TV.push([(2*IV[i][0]+IV[j][0])/3, (2*IV[i][1]+IV[j][1])/3, (2*IV[i][2]+IV[j][2])/3])
    TV.push([(IV[i][0]+2*IV[j][0])/3, (IV[i][1]+2*IV[j][1])/3, (IV[i][2]+2*IV[j][2])/3])
  }

  const getTV = (a: number, b: number): number => {
    const e = eIdx.get(a < b ? `${a},${b}` : `${b},${a}`)!
    return edges[e][0] === a ? 2*e : 2*e+1
  }

  // 20 icosahedron faces
  const icoFaces: [number, number, number][] = []
  for (let i = 0; i < 12; i++) for (const j of nbrs[i]) if (j > i)
    for (const k of nbrs[j]) if (k > j && nbrs[i].includes(k))
      icoFaces.push([i, j, k])

  // Vector helpers
  const cross = (a: V3, b: V3): V3 => [
    a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0],
  ]
  const dot  = (a: V3, b: V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
  const norm = (a: V3): V3 => { const l=Math.sqrt(dot(a,a)); return [a[0]/l,a[1]/l,a[2]/l] }
  const sub  = (a: V3, b: V3): V3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]]

  // Reverse polygon winding if the face normal points inward
  const ensureCCW = (poly: number[]) => {
    const v0=TV[poly[0]], v1=TV[poly[1]], v2=TV[poly[2]]
    if (dot(cross(sub(v1,v0),sub(v2,v0)), v0) < 0) poly.reverse()
  }

  // Pentagon: 5 TV verts around icosahedron vertex iv, sorted CCW
  const getPentagon = (iv: number): number[] => {
    const z = norm(IV[iv])
    const tmp: V3 = Math.abs(z[0]) < 0.9 ? [1,0,0] : [0,1,0]
    const x = norm(cross(tmp, z)), y = cross(z, x)
    const tvs = nbrs[iv].map(n => getTV(iv, n))
    tvs.sort((a, b) =>
      Math.atan2(dot(TV[a],y),dot(TV[a],x)) - Math.atan2(dot(TV[b],y),dot(TV[b],x))
    )
    ensureCCW(tvs)
    return tvs
  }

  // Hexagon: 6 TV verts tracing the face [a,b,c]
  const getHexagon = (a: number, b: number, c: number): number[] => {
    const tvs = [getTV(a,b),getTV(b,a),getTV(b,c),getTV(c,b),getTV(c,a),getTV(a,c)]
    ensureCCW(tvs)
    return tvs
  }

  const positions: number[] = [], normals: number[] = [], colors: number[] = []

  const addFace = (poly: number[], col: V3) => {
    for (let i = 1; i < poly.length - 1; i++) {
      const pts = [TV[poly[0]], TV[poly[i]], TV[poly[i+1]]].map(p => {
        const l = Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2])
        return [p[0]/l*r, p[1]/l*r, p[2]/l*r] as V3
      })
      const n = norm(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])))
      for (const [x,y,z] of pts) { positions.push(x,y,z); normals.push(...n); colors.push(...col) }
    }
  }

  for (let iv = 0; iv < 12; iv++) addFace(getPentagon(iv), [0.08, 0.08, 0.08])
  for (const [a,b,c] of icoFaces)  addFace(getHexagon(a,b,c), [0.96, 0.96, 0.96])

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3))
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3))
  return geo
}

const SOCCER_GEO = makeSoccerBallGeometry(BASE_RADIUS)
const SOCCER_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })

// ─────────────────────────────────────────────────────────────────────────────

export function Ball({ index = 0 }: { index?: number }) {
  const rb           = useRef<RapierRigidBody>(null)
  const phase        = useGameStore((s) => s.phase)
  const resetBall    = useGameStore((s) => s.resetBall)
  const currentTwist = useGameStore((s) => s.currentTwist)

  const isIce = currentTwist === 'iceRink'
  const start = BALL_STARTS[index] ?? BALL_STARTS[0]

  useEffect(() => {
    if (phase !== 'scored' || !rb.current) return
    const t = setTimeout(() => {
      if (!rb.current) return
      rb.current.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
      rb.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      const angle = Math.random() * Math.PI * 2
      rb.current.applyImpulse({ x: Math.cos(angle) * 0.06, y: 0, z: Math.sin(angle) * 0.06 }, true)
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

    if (index === 0 && delta > 0) {
      ballVel.x = (pos.x - prevPos.current.x) / delta
      ballVel.z = (pos.z - prevPos.current.z) / delta
      ballPos.x = pos.x; ballPos.y = pos.y; ballPos.z = pos.z
    }
    prevPos.current.x = pos.x
    prevPos.current.y = pos.y
    prevPos.current.z = pos.z

    if (phase === 'playing') {
      const vel   = rb.current.linvel()
      const speed = Math.sqrt(vel.x**2 + vel.z**2)
      if (speed < 0.08) {
        stuckTimer.current += delta
        if (stuckTimer.current > 1.0) {
          stuckTimer.current = 0
          const angle = Math.random() * Math.PI * 2
          rb.current.applyImpulse(
            { x: Math.cos(angle)*0.25, y: 0.04, z: Math.sin(angle)*0.25 }, true,
          )
        }
      } else {
        stuckTimer.current = 0
      }
    }

    if (currentTwist === 'earthquake') {
      quakeTimer.current += delta
      if (quakeTimer.current >= 0.3) {
        quakeTimer.current = 0
        rb.current.applyImpulse({
          x: (Math.random()-0.5)*0.18, y: 0, z: (Math.random()-0.5)*0.18,
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
      colliders={false}
      name="ball"
    >
      <BallCollider args={[BASE_RADIUS]} />
      <mesh castShadow geometry={SOCCER_GEO} material={SOCCER_MAT} />
    </RigidBody>
  )
}
