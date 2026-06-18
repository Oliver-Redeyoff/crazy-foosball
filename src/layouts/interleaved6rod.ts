import type { LayoutConfig } from './types'

// 6-rod interleaved layout — Red GK · Blue FWD · Red MID · Blue MID · Red FWD · Blue GK
// 5 players per team (GK×1 + MID×2 + FWD×2), 10 total
//
// Teams alternate rods so each rod faces opponents across the pitch.
// This flips both teams' attack directions vs the balanced layout:
//   Red GK  at -2.0 (defends −Z goal, attacks +Z)
//   Blue FWD at -1.2
//   Red MID  at -0.4
//   Blue MID at +0.4
//   Red FWD  at +1.2
//   Blue GK  at +2.0 (defends +Z goal, attacks −Z)
//
// Rod spacing: uniform 0.8 units throughout
// Table: 3.5 × 5.0, goal buffer 0.5 each end (GK at ±2.0)

export const INTERLEAVED_6_ROD: LayoutConfig = {
  name: '6-Rod Interleaved',
  description: 'Red GK(1) · Blue FWD(2) · Red MID(2) · Blue MID(2) · Red FWD(2) · Blue GK(1) — teams alternate rods',

  tableWidth:  3.5,
  tableLength: 5.0,
  goalWidth:   1.2,

  rods: [
    { z: -2.0, team: 'right', count: 1, role: 'GK'  }, // Red GK  (defends −Z goal)
    { z: -1.2, team: 'left',  count: 2, role: 'FWD' }, // Blue FWD
    { z: -0.4, team: 'right', count: 2, role: 'FWD' }, // Red MID
    { z:  0.4, team: 'left',  count: 2, role: 'FWD' }, // Blue MID
    { z:  1.2, team: 'right', count: 2, role: 'FWD' }, // Red FWD
    { z:  2.0, team: 'left',  count: 1, role: 'GK'  }, // Blue GK (defends +Z goal)
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
