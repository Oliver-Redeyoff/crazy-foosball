export type TwistId = 'multiBall' | 'bigGoals' | 'earthquake' | 'lowGravity' | 'iceRink' | 'reverseControls'

export interface Twist {
  id: TwistId
  name: string
  emoji: string
  description: string
}

export const TWISTS: Twist[] = [
  { id: 'multiBall',       name: 'MULTI BALL',       emoji: '💥', description: 'Three balls on the pitch!' },
  { id: 'bigGoals',        name: 'BIG GOALS',         emoji: '🥅', description: 'The goals are huge!' },
  { id: 'earthquake',      name: 'EARTHQUAKE',        emoji: '🌋', description: 'The pitch is shaking!' },
  { id: 'lowGravity',      name: 'LOW GRAVITY',       emoji: '🌙', description: 'The pitch has lost its gravity!' },
  { id: 'iceRink',         name: 'ICE RINK',          emoji: '🧊', description: 'The pitch is a sheet of ice!' },
  { id: 'reverseControls', name: 'REVERSE CONTROLS',  emoji: '🔄', description: 'Your controls are flipped!' },
]

export function getTwist(id: TwistId | null): Twist | null {
  return id ? (TWISTS.find(t => t.id === id) ?? null) : null
}

export function pickNextTwist(exclude?: TwistId | null): Twist {
  const pool = TWISTS.filter(t => t.id !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function goalScale(id: TwistId | null): number  { return id === 'bigGoals'  ? 1.85 : 1 }
export function ballCount(id: TwistId | null): number  { return id === 'multiBall' ? 3    : 1 }
