import { create } from 'zustand'
import { type TwistId, pickNextTwist } from './twists'

type Phase = 'playing' | 'scored' | 'won' | 'paused'
export type GameMode  = 'classic' | 'crazy'
export type Difficulty = 'easy' | 'medium' | 'hard'

const WIN_SCORE = 6

interface GameState {
  scoreLeft: number
  scoreRight: number
  phase: Phase
  lastScorer: 'left' | 'right' | null
  winner: 'left' | 'right' | null
  activeRodP1: number
  activeRodP2: number
  isRodDragging: boolean
  currentTwist: TwistId | null
  pendingTwist: TwistId | null
  appState: 'menu' | 'game'
  gameMode: GameMode
  difficulty: Difficulty
  resetKey: number
  startGame: (mode: GameMode, difficulty: Difficulty) => void
  incrementScore: (side: 'left' | 'right') => void
  resetBall: () => void
  playAgain: () => void
  setActiveRod: (player: 1 | 2, index: number) => void
  setRodDragging: (v: boolean) => void
  resetGame: () => void
}

export const useGameStore = create<GameState>((set) => ({
  scoreLeft: 0,
  scoreRight: 0,
  phase: 'playing',
  lastScorer: null,
  winner: null,
  activeRodP1: 2,
  activeRodP2: 1,
  isRodDragging: false,
  currentTwist: null,
  pendingTwist: null,
  appState: 'menu',
  gameMode: 'classic',
  difficulty: 'easy',
  resetKey: 0,

  startGame: (mode, difficulty) =>
    set((s) => ({ appState: 'game', gameMode: mode, difficulty, scoreLeft: 0, scoreRight: 0, phase: 'playing', lastScorer: null, winner: null, currentTwist: null, pendingTwist: null, resetKey: s.resetKey + 1 })),

  incrementScore: (side) =>
    set((s) => {
      const newLeft  = side === 'left'  ? s.scoreLeft  + 1 : s.scoreLeft
      const newRight = side === 'right' ? s.scoreRight + 1 : s.scoreRight
      const won      = newLeft >= WIN_SCORE || newRight >= WIN_SCORE
      return {
        scoreLeft:    newLeft,
        scoreRight:   newRight,
        phase:        won ? 'won' : 'scored',
        lastScorer:   side,
        winner:       won ? side : null,
        pendingTwist: !won && s.gameMode === 'crazy' ? pickNextTwist(s.currentTwist).id : null,
      }
    }),

  resetBall: () =>
    set((s) => {
      if (s.phase === 'won') return {}
      return { phase: 'playing', currentTwist: s.pendingTwist, pendingTwist: null }
    }),

  playAgain: () =>
    set({ scoreLeft: 0, scoreRight: 0, phase: 'playing', lastScorer: null, winner: null, currentTwist: null, pendingTwist: null }),

  setActiveRod: (player, index) =>
    set(player === 1 ? { activeRodP1: index } : { activeRodP2: index }),

  setRodDragging: (v) => set({ isRodDragging: v }),

  resetGame: () =>
    set({ appState: 'menu', scoreLeft: 0, scoreRight: 0, phase: 'playing', lastScorer: null, winner: null, currentTwist: null, pendingTwist: null }),
}))
