import { Scene } from './components/Scene'
import { ScoreUI } from './components/ScoreUI'
import './App.css'

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Scene />
      <ScoreUI />
    </div>
  )
}
