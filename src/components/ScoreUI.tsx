import { useGameStore } from '../store'
import { getTwist } from '../twists'

export function ScoreUI() {
  const scoreLeft    = useGameStore((s) => s.scoreLeft)
  const scoreRight   = useGameStore((s) => s.scoreRight)
  const phase        = useGameStore((s) => s.phase)
  const lastScorer   = useGameStore((s) => s.lastScorer)
  const resetGame    = useGameStore((s) => s.resetGame)
  const playAgain    = useGameStore((s) => s.playAgain)
  const currentTwist = useGameStore((s) => s.currentTwist)
  const pendingTwist = useGameStore((s) => s.pendingTwist)
  const gameMode     = useGameStore((s) => s.gameMode)
  const winner       = useGameStore((s) => s.winner)

  const activeTwist   = gameMode === 'crazy' ? getTwist(currentTwist) : null
  const incomingTwist = gameMode === 'crazy' ? getTwist(pendingTwist)  : null

  return (
    <div style={styles.root}>
      {/* Scoreboard */}
      <div style={styles.scoreboard}>
        <div style={{ ...styles.team, ...styles.teamLeft }}>
          <span style={styles.teamName}>RED</span>
          <span style={styles.score}>{scoreLeft}</span>
        </div>
        <div style={styles.divider}>:</div>
        <div style={{ ...styles.team, ...styles.teamRight }}>
          <span style={styles.score}>{scoreRight}</span>
          <span style={styles.teamName}>BLUE</span>
        </div>
      </div>

      {/* Goal + twist announcement */}
      {phase === 'scored' && (
        <div style={styles.goalBanner}>
          <div style={styles.goalText}>GOAL!</div>
          <div style={styles.goalSub}>
            {lastScorer === 'left' ? '🔴 Red scores!' : '🔵 Blue scores!'}
          </div>
          {incomingTwist && (
            <div style={styles.twistAnnounce}>
              <div style={styles.twistLabel}>NEXT TWIST</div>
              <div style={styles.twistName}>{incomingTwist.emoji} {incomingTwist.name}</div>
              <div style={styles.twistDesc}>{incomingTwist.description}</div>
            </div>
          )}
        </div>
      )}

      {/* Active twist badge */}
      {activeTwist && phase === 'playing' && (
        <div style={styles.twistBadge}>
          {activeTwist.emoji} {activeTwist.name}
        </div>
      )}

      {/* Controls hint */}
      <div style={styles.controls}>
        <div style={styles.controlCol}>
          <strong>Controls (Blue)</strong>
          {'ontouchstart' in window
            ? <span>Drag — slide players</span>
            : <span>Mouse ↑↓ — slide players</span>
          }
          {'ontouchstart' in window
            ? <span>↺ ↻ buttons — spin</span>
            : <>
                <span>A — rotate backwards 90°</span>
                <span>D — kick forward 90°</span>
              </>
          }
        </div>
      </div>

      {/* Back to menu */}
      <button style={styles.resetBtn} onClick={resetGame}>
        ← Menu
      </button>

      {/* Winner overlay */}
      {winner && (
        <div style={styles.winOverlay}>
          <div style={styles.winEmoji}>{winner === 'left' ? '🔴' : '🔵'}</div>
          <div style={styles.winText}>{winner === 'left' ? 'RED' : 'BLUE'} WINS!</div>
          <div style={styles.winScore}>{scoreLeft} — {scoreRight}</div>
          <div style={styles.winBtns}>
            <button style={styles.winBtnPrimary} onClick={playAgain}>Play Again</button>
            <button style={styles.winBtnSecondary} onClick={resetGame}>← Menu</button>
          </div>
        </div>
      )}
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
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    padding: '28px 48px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  goalText: {
    fontSize: 56,
    fontWeight: 900,
    color: '#facc15',
    textShadow: '0 0 30px rgba(250,204,21,0.8)',
    letterSpacing: '0.05em',
    lineHeight: 1,
  },
  goalSub: {
    fontSize: 20,
    color: '#fff',
  },
  twistAnnounce: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    background: 'rgba(0,0,0,0.6)',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: '12px 28px',
    backdropFilter: 'blur(8px)',
  },
  twistLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: '#aaa',
    textTransform: 'uppercase' as const,
  },
  twistName: {
    fontSize: 32,
    fontWeight: 900,
    color: '#fff',
    textShadow: '0 0 20px rgba(255,255,255,0.5)',
    letterSpacing: '0.05em',
  },
  twistDesc: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 2,
  },
  twistBadge: {
    marginTop: 12,
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: '4px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    backdropFilter: 'blur(4px)',
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
  winOverlay: {
    position: 'fixed' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(8px)',
    pointerEvents: 'all',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  winEmoji: { fontSize: 72, lineHeight: 1 },
  winText: {
    fontSize: 64,
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '0.06em',
    textShadow: '0 0 40px rgba(255,255,255,0.4)',
  },
  winScore: {
    fontSize: 28,
    fontWeight: 300,
    color: '#aaa',
    letterSpacing: '0.1em',
  },
  winBtns: {
    marginTop: 12,
    display: 'flex',
    gap: 12,
  },
  winBtnPrimary: {
    padding: '14px 36px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  winBtnSecondary: {
    padding: '14px 24px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
