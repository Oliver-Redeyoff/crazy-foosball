import type { LayoutConfig } from './types'

// 4-rod arcade layout — the original layout before switching to 6-rod balanced.
// GK(1) · FWD(2) · FWD(2) · GK(1)  →  3 players per team, 6 total
//
// Rod spacing: uniform 1.2 units (GK-FWD and FWD-FWD gaps equal)
// Both middle rods are FWD for both teams, facing toward the goal they attack.
// Issue noted: the two FWD rods in the centre visually look identical and it isn't
// immediately obvious which team's FWD is attacking which direction.

export const ARCADE_4_ROD: LayoutConfig = {
  name: '4-Rod Arcade',
  description: 'GK(1) · FWD(2) · FWD(2) · GK(1) — 3 players per team',

  tableWidth:  3.5,
  tableLength: 5.0,
  goalWidth:   1.2,

  rods: [
    { z: -1.8, team: 'left',  count: 1, role: 'GK'  }, // Blue GK
    { z: -0.6, team: 'right', count: 2, role: 'FWD' }, // Red FWD
    { z:  0.6, team: 'left',  count: 2, role: 'FWD' }, // Blue FWD
    { z:  1.8, team: 'right', count: 1, role: 'GK'  }, // Red GK
  ],

  rodY:            0.84,
  bodyWidth:       0.28,
  bodyHeight:      0.54,
  bodyDepth:       0.08,
  footWidth:       0.30,
  footHeight:      0.12,
  footDepth:       0.08,
  footDistFromRod: 0.78,
  headRadius:      0.14,
}
