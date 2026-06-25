import { useEffect } from 'react'
import { touchControls } from '../touchState'

const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const btn: React.CSSProperties = {
  width: 76, height: 76,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.35)',
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontSize: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  cursor: 'pointer',
  backdropFilter: 'blur(4px)',
  pointerEvents: 'auto',
}

export function MobileControls({ isPortrait }: { isPortrait: boolean }) {
  // Keep touchControls.isPortrait in sync so Rods knows which drag axis to use.
  useEffect(() => {
    touchControls.isPortrait = isPortrait
  }, [isPortrait])

  // Release spin buttons if the page loses visibility (prevent stuck inputs).
  useEffect(() => {
    const release = () => { touchControls.spinFwd = false; touchControls.spinBack = false }
    document.addEventListener('visibilitychange', release)
    return () => document.removeEventListener('visibilitychange', release)
  }, [])

  if (!IS_TOUCH) return null

  const container: React.CSSProperties = isPortrait
    ? { position: 'fixed', bottom: 36, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 40, zIndex: 20, pointerEvents: 'none' }
    : { position: 'fixed', bottom: 36, right: 28, display: 'flex', flexDirection: 'column', gap: 20, zIndex: 20, pointerEvents: 'none' }

  return (
    <div style={container}>
      <button
        style={btn}
        onPointerDown={() => { touchControls.spinBack = true }}
        onPointerUp={() => { touchControls.spinBack = false }}
        onPointerLeave={() => { touchControls.spinBack = false }}
        onPointerCancel={() => { touchControls.spinBack = false }}
      >↺</button>
      <button
        style={btn}
        onPointerDown={() => { touchControls.spinFwd = true }}
        onPointerUp={() => { touchControls.spinFwd = false }}
        onPointerLeave={() => { touchControls.spinFwd = false }}
        onPointerCancel={() => { touchControls.spinFwd = false }}
      >↻</button>
    </div>
  )
}
