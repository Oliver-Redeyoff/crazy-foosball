# Crazy Foosball — CLAUDE.md

## Project overview

3D foosball game built with React 19, Three.js, React Three Fiber, and the Rapier physics engine. Classic mode is standard foosball; Crazy mode adds a random twist every round. First to 6 goals wins.

Dev server: `npm run dev` (Vite on port 5173). Build: `npm run build`. No test suite.

## Tech stack

| Layer | Library |
|---|---|
| Renderer | `@react-three/fiber` v9 (R3F) + `three` v0.184 |
| Physics | `@react-three/rapier` v2 (wraps Rapier WASM) |
| State | `zustand` v5 |
| Helpers | `@react-three/drei` v10 |
| Bundler | Vite + TypeScript |

**HMR caveat**: Vite HMR triggers a full page reload when imports change (e.g. adding/removing a Rapier import). This is expected — the game restarts cleanly.

## Key architecture decisions

### Coordinate system
- Table runs along the **Z axis**: `z = -4` is the left/red end, `z = +4` is the blue/right end.
- `TABLE.length = 8`, `TABLE.width = 5`, floor at `y = 0`.
- All TABLE constants are exported from `src/components/Table.tsx`.

### Physics bodies
- **Ball**: dynamic `RigidBody` with explicit `<BallCollider>` (sphere). Uses `colliders={false}` so geometry doesn't auto-collide. `ccd` enabled to prevent tunnelling.
- **Rods/players**: `kinematicPosition` rigid bodies. Position/rotation set imperatively every frame in `useFrame`.
- **Table surfaces**: `type="fixed"` rigid bodies. The goal physics net walls use very low restitution (`0.05`) and high friction (`0.9`) so the ball dies on contact.
- **Goal sensors**: invisible `sensor` rigid bodies that fire `onIntersectionEnter` to trigger `incrementScore`.

### Shared mutable state for ball tracking
`src/ballState.ts` exports plain mutable objects (`ballPos`, `ballVel`) that `Ball.tsx` writes every frame and AI/other systems read. This avoids React re-render overhead for per-frame updates.

### Zustand store (`src/store.ts`)
- `phase`: `'playing' | 'scored' | 'won'`
- `appState`: `'menu' | 'game'`
- `currentTwist`: active `TwistId | null`
- `pendingTwist`: queued for next round (set at score time, applied on `resetBall`)
- Score: `scoreLeft` / `scoreRight` (left = red team at −Z, right = blue team at +Z). Win at 6.

## File map

```
src/
  components/
    Ball.tsx          — Truncated icosahedron visual + sphere physics + stuck/earthquake/ice logic
    Table.tsx         — Playing surface, walls, goal boxes (posts, nets, physics colliders), goal lines
    Rods.tsx          — Rod assemblies, player meshes, controls, rule-based AI state machine
    GoalSensors.tsx   — Invisible sensor triggers that call incrementScore
    Scene.tsx         — Canvas, Physics provider, camera, lighting, twist controllers
    ScoreUI.tsx       — HUD overlay (score, twist badge, win screen)
    Menu.tsx          — Main menu (mode + difficulty selection)
  layouts/
    types.ts          — RodDef / LayoutConfig types (currently unused by Rods.tsx)
  ai/
    onnxPolicy.ts     — Stub for a future ONNX-based AI policy
  store.ts            — Zustand game state
  ballState.ts        — Mutable per-frame ball position/velocity
  twists.ts           — Twist definitions, goalScale(), ballCount(), pickNextTwist()
  useControls.ts      — Keyboard/mouse input hook
```

## Rod / player layout (Rods.tsx)

Six rods, interleaved teams along Z:

| Index | Team | Role | Z (approx) |
|---|---|---|---|
| 0 | Red (AI) | GK | −3.5 |
| 1 | Blue (player) | FWD | −2.1 |
| 2 | Red (AI) | MID | −0.7 |
| 3 | Blue (player) | MID | +0.7 |
| 4 | Red (AI) | FWD | +2.1 |
| 5 | Blue (player) | GK | +3.5 |

- Red defends the **−Z goal**; Blue defends the **+Z goal**.
- `PLAYER_TEAM = 'left'`, `AI_TEAM = 'right'` (confusingly, "left/right" here refer to team IDs in the store, not screen sides).

### Player feet
Each player has an **octagonal prism foot** (`ConvexHullCollider` + `cylinderGeometry` with 8 segments). The `Math.PI/8` rotation offset aligns a flat face with ±Z so a direct kick goes straight; the adjacent 45° faces produce diagonal deflections on side contact.

## AI state machine (Rods.tsx — `AiRodState`)

Phases: `'idle' | 'firing' | 'returning' | 'scoop-back' | 'scoop-slide' | 'scoop-kick'`

- **idle → firing**: ball is in front of this rod and within X range → spin forward to kick.
- **idle → scoop-back**: ball is slightly behind (within 0.5 units) → rotate backward first, slide over ball, kick forward (scoop move).
- **returning**: after kick, spin back to neutral.
- Difficulty scales `speedMul`, `kickDelay`, `predWindow`, and noise level via `DIFF_CFG`.

## Twists (src/twists.ts)

| ID | Effect |
|---|---|
| `multiBall` | 3 balls (extra Ball instances with index 1, 2) |
| `bigGoals` | `goalScale = 1.85` — resizes goal colliders + visuals |
| `earthquake` | Random impulses on ball + camera shake |
| `lowGravity` | Sets `world.gravity.y = -2.5` |
| `iceRink` | Pitch friction → 0, ball damping → near-zero, blue floor tint |
| `reverseControls` | Input direction inverted in `useControls.ts` |

Twist is applied at `resetBall` (start of next round). `GoalWalls` and floor keyed by twist so Rapier remounts colliders when sizes change.

## Goal geometry (Table.tsx)

- `TABLE.goalW = 2`, `TABLE.goalH = 1.3`, `TABLE.goalDepth = 0.8`.
- `GoalBox` renders at `[0, 0, ±hl]` (group position). `sign = position[2] < 0 ? -1 : 1`.
- Physics net walls: 5 `CuboidCollider`s (back, left, right, top, floor) inside one `RigidBody`. Floor collider is at `y = -wt/2` so its top surface is flush with the pitch at `y = 0`.
- Back net is a **deformable mesh** (`DeformableNet` component, 14×9 vertex grid). Vertices spring-deform when `ballPos` is inside the goal volume. Edge vertices are pinned. Side/top nets remain static wireframes.
- Goal mouth lines: white semi-transparent `planeGeometry` meshes at `z = ±hl`, width = `goalW`, same style as the center line.
- Team colours: red goal at `z = -hl`, blue goal at `z = +hl`.
- Goal sensor (in `GoalSensors.tsx`) is offset 70% of goal depth inward and narrowed by `BALL_RADIUS + 0.05` in X to avoid false positives from balls grazing the post.

## Patterns to follow

- Mutate Rapier body positions with `rb.current.setNextKinematicTranslation` / `setNextKinematicRotation` inside `useFrame` — never in React state.
- For per-frame data shared across components, use a plain mutable object (like `ballPos`) rather than Zustand to avoid re-renders.
- When creating deformable/particle geometry, create `THREE.BufferGeometry` in `useMemo`, hold a closure reference, and set `attribute.needsUpdate = true` in `useFrame`. Don't use JSX `<bufferAttribute>` for mutable data.
- Key `RigidBody` components with twist-dependent props (e.g. `key={\`floor-${isIce}\`}`) so Rapier remounts and reinitialises the physics body when parameters change.
- `colliders={false}` + explicit `<BallCollider>` / `<CuboidCollider>` / `<ConvexHullCollider>` for precise control. Avoid auto-generated colliders for game objects.
