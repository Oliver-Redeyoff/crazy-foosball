import { Scene } from './components/Scene'
import { ScoreUI } from './components/ScoreUI'
import { Menu } from './components/Menu'
import { useGameStore } from './store'
import './App.css'

export default function App() {
  const appState = useGameStore((s) => s.appState)

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Scene />
      {appState === 'menu' ? <Menu /> : <ScoreUI />}
    </div>
  )
}
