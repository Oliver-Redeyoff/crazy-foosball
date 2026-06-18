import { useState } from 'react'
import { useGameStore, type GameMode, type Difficulty } from '../store'

const MODES: { id: GameMode; label: string; emoji: string; desc: string }[] = [
  { id: 'classic', label: 'Classic',  emoji: '⚽', desc: 'Standard foosball, no gimmicks' },
  { id: 'crazy',   label: 'Crazy',    emoji: '🌀', desc: 'A new twist every round' },
]

const DIFFICULTIES: { id: Difficulty; label: string; emoji: string; desc: string }[] = [
  { id: 'easy',   label: 'Easy',   emoji: '😴', desc: 'Slow & sloppy opponent' },
  { id: 'medium', label: 'Medium', emoji: '😐', desc: 'Balanced challenge' },
  { id: 'hard',   label: 'Hard',   emoji: '😤', desc: 'Fast & precise opponent' },
]

export function Menu() {
  const startGame = useGameStore((s) => s.startGame)
  const [mode, setMode]         = useState<GameMode>('crazy')
  const [difficulty, setDiff]   = useState<Difficulty>('medium')

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.title}>FOOSBALL</div>
        <div style={s.subtitle}>Pick your game</div>

        <div style={s.sectionLabel}>MODE</div>
        <div style={s.row}>
          {MODES.map(m => (
            <button
              key={m.id}
              style={{ ...s.optBtn, ...(mode === m.id ? s.optBtnActive : {}) }}
              onClick={() => setMode(m.id)}
            >
              <span style={s.optEmoji}>{m.emoji}</span>
              <span style={s.optLabel}>{m.label}</span>
              <span style={s.optDesc}>{m.desc}</span>
            </button>
          ))}
        </div>

        <div style={s.sectionLabel}>DIFFICULTY</div>
        <div style={s.row}>
          {DIFFICULTIES.map(d => (
            <button
              key={d.id}
              style={{ ...s.optBtn, ...(difficulty === d.id ? s.optBtnActive : {}) }}
              onClick={() => setDiff(d.id)}
            >
              <span style={s.optEmoji}>{d.emoji}</span>
              <span style={s.optLabel}>{d.label}</span>
              <span style={s.optDesc}>{d.desc}</span>
            </button>
          ))}
        </div>

        <button style={s.playBtn} onClick={() => startGame(mode, difficulty)}>
          PLAY
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 10, 20, 0.82)',
    backdropFilter: 'blur(6px)',
    zIndex: 100,
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: '40px 48px',
    minWidth: 480,
  },
  title: {
    fontSize: 52,
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '0.08em',
    textShadow: '0 0 40px rgba(255,255,255,0.3)',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginTop: -12,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 700,
    color: '#666',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: -8,
  },
  row: {
    display: 'flex',
    gap: 12,
    width: '100%',
  },
  optBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '14px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#ccc',
  },
  optBtnActive: {
    background: 'rgba(255,255,255,0.12)',
    border: '1.5px solid rgba(255,255,255,0.4)',
    color: '#fff',
    boxShadow: '0 0 16px rgba(255,255,255,0.08)',
  },
  optEmoji: {
    fontSize: 28,
    lineHeight: 1,
  },
  optLabel: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  optDesc: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  playBtn: {
    marginTop: 8,
    width: '100%',
    padding: '16px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
}
