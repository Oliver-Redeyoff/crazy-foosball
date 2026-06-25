import { useState, useEffect } from 'react'
import { Scene } from './components/Scene'
import { ScoreUI } from './components/ScoreUI'
import { Menu } from './components/Menu'
import { MobileControls } from './components/MobileControls'
import { useGameStore } from './store'
import './App.css'

export default function App() {
  const appState = useGameStore((s) => s.appState)

  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  )

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Scene isPortrait={isPortrait} />
      {appState === 'menu' ? <Menu /> : <ScoreUI />}
      <MobileControls isPortrait={isPortrait} />
    </div>
  )
}
