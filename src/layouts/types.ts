export type Team = 'left' | 'right'
export type Role = 'GK' | 'DEF' | 'FWD'

export interface RodDef {
  z: number
  team: Team
  count: number  // players on this rod
  role: Role
}

export interface LayoutConfig {
  name: string
  description: string
  // Pitch
  tableWidth: number
  tableLength: number
  goalWidth: number
  // Rods
  rods: RodDef[]
  // Rod geometry
  rodY: number           // rod centre height above floor
  // Player geometry
  bodyWidth: number      // X
  bodyHeight: number     // Y
  bodyDepth: number      // Z
  footWidth: number
  footHeight: number
  footDepth: number      // Z
  footDistFromRod: number  // centre of foot below rod (Y)
  headRadius: number
}
