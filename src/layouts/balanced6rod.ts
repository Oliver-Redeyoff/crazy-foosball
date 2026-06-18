import type { LayoutConfig } from './types'

// 6-rod balanced layout — GK · DEF · FWD · FWD · DEF · GK
// 5 players per team (GK×1 + DEF×2 + FWD×2), 10 total
//
// Both teams occupy their own half of the pitch:
//   Blue: GK at -2.0 | DEF at -1.2 | FWD at -0.4
//   Red:  FWD at +0.4 | DEF at +1.2 | GK at +2.0
//
// Rod spacing: uniform 0.8 units throughout
// Table: 3.5 × 5.0, goal buffer 0.5 each end (GK at ±2.0)

export const BALANCED_6_ROD: LayoutConfig = {
  name: '6-Rod Balanced',
  description: 'GK(1) · DEF(2) · FWD(2) · FWD(2) · DEF(2) · GK(1) — 5 players per team',

  tableWidth:  3.5,
  tableLength: 5.0,
  goalWidth:   1.2,

  rods: [
    { z: -2.0, team: 'left',  count: 1, role: 'GK'  }, // Blue GK
    { z: -1.2, team: 'left',  count: 2, role: 'DEF' }, // Blue DEF
    { z: -0.4, team: 'left',  count: 2, role: 'FWD' }, // Blue FWD
    { z:  0.4, team: 'right', count: 2, role: 'FWD' }, // Red FWD
    { z:  1.2, team: 'right', count: 2, role: 'DEF' }, // Red DEF
    { z:  2.0, team: 'right', count: 1, role: 'GK'  }, // Red GK
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
