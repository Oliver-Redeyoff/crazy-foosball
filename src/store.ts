import { create } from 'zustand'
import { type TwistId, pickNextTwist } from './twists'

type Phase = 'playing' | 'scored' | 'paused'

interface GameState {
  scoreLeft: number
  scoreRight: number
  phase: Phase
  lastScorer: 'left' | 'right' | null
  activeRodP1: number
  activeRodP2: number
  isRodDragging: boolean
  currentTwist: TwistId | null
  pendingTwist: TwistId | null
  incrementScore: (side: 'left' | 'right') => void
  resetBall: () => void
  setActiveRod: (player: 1 | 2, index: number) => void
  setRodDragging: (v: boolean) => void
  resetGame: () => void
}

export const useGameStore = create<GameState>((set) => ({
  scoreLeft: 0,
  scoreRight: 0,
  phase: 'playing',
  lastScorer: null,
  activeRodP1: 2,
  activeRodP2: 1,
  isRodDragging: false,
  currentTwist: null,
  pendingTwist: null,

  incrementScore: (side) =>
    set((s) => ({
      scoreLeft:   side === 'left'  ? s.scoreLeft  + 1 : s.scoreLeft,
      scoreRight:  side === 'right' ? s.scoreRight + 1 : s.scoreRight,
      phase:       'scored',
      lastScorer:  side,
      pendingTwist: pickNextTwist(s.currentTwist).id,
    })),

  resetBall: () =>
    set((s) => ({
      phase:        'playing',
      currentTwist: s.pendingTwist,
      pendingTwist: null,
    })),

  setActiveRod: (player, index) =>
    set(player === 1 ? { activeRodP1: index } : { activeRodP2: index }),

  setRodDragging: (v) => set({ isRodDragging: v }),

  resetGame: () =>
    set({ scoreLeft: 0, scoreRight: 0, phase: 'playing', lastScorer: null, currentTwist: null, pendingTwist: null }),
}))
