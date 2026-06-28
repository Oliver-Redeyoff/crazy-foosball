import { useState, useEffect } from 'react'
import { useGameStore, type GameMode, type Difficulty } from '../store'

const MODES: { id: GameMode; label: string; emoji: string }[] = [
  { id: 'classic', label: 'Classic', emoji: '⚽' },
  { id: 'crazy',   label: 'Crazy',   emoji: '🌀' },
]
const DIFFICULTIES: { id: Difficulty; label: string; emoji: string }[] = [
  { id: 'easy',   label: 'Easy',   emoji: '😴' },
  { id: 'medium', label: 'Medium', emoji: '😐' },
  { id: 'hard',   label: 'Hard',   emoji: '😤' },
]

export function Menu() {
  const startGame = useGameStore((s) => s.startGame)
  const [mode, setMode]       = useState<GameMode>('classic')
  const [difficulty, setDiff] = useState<Difficulty>('easy')
  const [compact, setCompact] = useState(() => window.innerHeight < 520)

  useEffect(() => {
    const mq = window.matchMedia('(max-height: 519px)')
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const c = compact

  return (
    <div style={{ ...s.overlay, padding: c ? 8 : 16 }}>
      <div style={s.card}>
        <div style={{ ...s.inner, gap: c ? 8 : 16, padding: c ? '16px 24px' : '32px 32px' }}>
          <div style={s.titleWrap}>
            <div style={{ ...s.title, fontSize: c ? 28 : 42 }}>CRAZY FOOSBALL</div>
          </div>

          <div style={{ ...s.sectionLabel, marginBottom: c ? -4 : -8 }}>MODE</div>
          <div style={{ ...s.row, gap: c ? 8 : 12 }}>
            {MODES.map(m => (
              <button
                key={m.id}
                style={{
                  ...s.optBtn,
                  padding: c ? '8px 10px' : '14px 10px',
                  gap: c ? 2 : 4,
                  ...(mode === m.id ? (m.id === 'classic' ? s.optBtnBlue : s.optBtnRed) : {}),
                }}
                onClick={() => setMode(m.id)}
              >
                <span style={{ ...s.optEmoji, fontSize: c ? 20 : 28 }}>{m.emoji}</span>
                <span style={{ ...s.optLabel, fontSize: c ? 12 : 14 }}>{m.label}</span>
              </button>
            ))}
          </div>

          <div style={{ ...s.sectionLabel, marginBottom: c ? -4 : -8 }}>DIFFICULTY</div>
          <div style={{ ...s.row, gap: c ? 8 : 12 }}>
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                style={{
                  ...s.optBtn,
                  padding: c ? '8px 6px' : '14px 10px',
                  gap: c ? 2 : 4,
                  ...(difficulty === d.id
                    ? d.id === 'easy'   ? s.optBtnGreen
                    : d.id === 'medium' ? s.optBtnOrange
                    :                    s.optBtnRed
                    : {}),
                }}
                onClick={() => setDiff(d.id)}
              >
                <span style={{ ...s.optEmoji, fontSize: c ? 20 : 28 }}>{d.emoji}</span>
                <span style={{ ...s.optLabel, fontSize: c ? 12 : 14 }}>{d.label}</span>
              </button>
            ))}
          </div>

          <button
            style={{ ...s.playBtn, padding: c ? '10px' : '16px', fontSize: c ? 15 : 18, marginTop: c ? 2 : 8 }}
            onClick={() => startGame(mode, difficulty)}
          >
            PLAY
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    background: 'linear-gradient(135deg, rgba(5,12,55,0.92) 0%, rgba(30,5,30,0.92) 50%, rgba(55,5,12,0.92) 100%)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  card: {
    margin: 'auto',
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(40,80,220,0.13) 0%, rgba(220,40,70,0.13) 100%)',
    border: '1px solid rgba(255,255,255,0.13)',
    boxShadow: '-10px 0 50px rgba(50,90,255,0.2), 10px 0 50px rgba(255,50,80,0.2)',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontWeight: 900,
    letterSpacing: '0.08em',
    background: 'linear-gradient(90deg, #7799ff 0%, #ffffff 45%, #ff7788 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginTop: -4,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 700,
    color: '#666',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  row: {
    display: 'flex',
    width: '100%',
  },
  optBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#bbb',
  },
  optBtnBlue: {
    background: 'rgba(55,100,255,0.22)',
    border: '1.5px solid rgba(100,145,255,0.65)',
    color: '#fff',
    boxShadow: '0 0 18px rgba(55,100,255,0.28)',
  },
  optBtnRed: {
    background: 'rgba(255,50,75,0.22)',
    border: '1.5px solid rgba(255,100,115,0.65)',
    color: '#fff',
    boxShadow: '0 0 18px rgba(255,50,75,0.28)',
  },
  optBtnGreen: {
    background: 'rgba(35,195,100,0.2)',
    border: '1.5px solid rgba(60,220,120,0.6)',
    color: '#fff',
    boxShadow: '0 0 18px rgba(35,195,100,0.22)',
  },
  optBtnOrange: {
    background: 'rgba(255,155,35,0.2)',
    border: '1.5px solid rgba(255,180,60,0.6)',
    color: '#fff',
    boxShadow: '0 0 18px rgba(255,155,35,0.22)',
  },
  optEmoji: {
    lineHeight: 1,
  },
  optLabel: {
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  playBtn: {
    width: '100%',
    background: 'linear-gradient(90deg, #3366ff 0%, #ff3355 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontWeight: 900,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    boxShadow: '0 4px 24px rgba(140,60,180,0.45)',
  },
}
