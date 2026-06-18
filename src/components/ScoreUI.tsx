import { useGameStore } from '../store'

export function ScoreUI() {
  const scoreLeft = useGameStore((s) => s.scoreLeft)
  const scoreRight = useGameStore((s) => s.scoreRight)
  const phase = useGameStore((s) => s.phase)
  const lastScorer = useGameStore((s) => s.lastScorer)
  const resetGame = useGameStore((s) => s.resetGame)

  return (
    <div style={styles.root}>
      {/* Scoreboard */}
      <div style={styles.scoreboard}>
        <div style={{ ...styles.team, ...styles.teamLeft }}>
          <span style={styles.teamName}>BLUE</span>
          <span style={styles.score}>{scoreLeft}</span>
        </div>
        <div style={styles.divider}>:</div>
        <div style={{ ...styles.team, ...styles.teamRight }}>
          <span style={styles.score}>{scoreRight}</span>
          <span style={styles.teamName}>RED</span>
        </div>
      </div>

      {/* Goal banner */}
      {phase === 'scored' && (
        <div style={styles.goalBanner}>
          <div style={styles.goalText}>GOAL!</div>
          <div style={styles.goalSub}>
            {lastScorer === 'left' ? '🔵 Blue scores!' : '🔴 Red scores!'}
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div style={styles.controls}>
        <div style={styles.controlCol}>
          <strong>Controls</strong>
          <span>Click & drag a rod</span>
          <span>← → — slide</span>
          <span>↑ ↓ — spin</span>
        </div>
      </div>

      {/* Reset */}
      <button style={styles.resetBtn} onClick={resetGame}>
        Reset Game
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    userSelect: 'none',
  },
  scoreboard: {
    marginTop: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: 'rgba(0,0,0,0.65)',
    padding: '8px 28px',
    borderRadius: 12,
    backdropFilter: 'blur(6px)',
  },
  team: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  teamLeft: { flexDirection: 'row' },
  teamRight: { flexDirection: 'row-reverse' },
  teamName: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#aaa',
  },
  score: {
    fontSize: 40,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
    minWidth: 36,
    textAlign: 'center',
  },
  divider: {
    fontSize: 32,
    fontWeight: 300,
    color: '#666',
  },
  goalBanner: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    animation: 'pulse 0.4s ease',
  },
  goalText: {
    fontSize: 56,
    fontWeight: 900,
    color: '#facc15',
    textShadow: '0 0 30px rgba(250,204,21,0.8)',
    letterSpacing: '0.05em',
  },
  goalSub: {
    fontSize: 20,
    color: '#fff',
    marginTop: -4,
  },
  controls: {
    position: 'fixed' as const,
    bottom: 16,
    left: 16,
    display: 'flex',
    gap: 24,
    background: 'rgba(0,0,0,0.5)',
    padding: '10px 16px',
    borderRadius: 8,
    backdropFilter: 'blur(4px)',
  },
  controlCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    fontSize: 12,
    color: '#ccc',
    lineHeight: '1.6',
  },
  resetBtn: {
    position: 'fixed' as const,
    bottom: 16,
    right: 16,
    pointerEvents: 'all',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
}
