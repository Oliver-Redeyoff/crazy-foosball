import { useEffect, useRef } from 'react'

export interface Controls {
  // P1 (left team) — WASD + Q/E spin + Tab cycle
  p1Left: boolean
  p1Right: boolean
  p1SpinFwd: boolean
  p1SpinBack: boolean
  p1NextRod: boolean
  p1PrevRod: boolean
  // P2 (right team) — Arrows + ,/. spin + Shift+Tab / \ cycle
  p2Left: boolean
  p2Right: boolean
  p2SpinFwd: boolean
  p2SpinBack: boolean
  p2NextRod: boolean
  p2PrevRod: boolean
}

const initial: Controls = {
  p1Left: false, p1Right: false, p1SpinFwd: false, p1SpinBack: false,
  p1NextRod: false, p1PrevRod: false,
  p2Left: false, p2Right: false, p2SpinFwd: false, p2SpinBack: false,
  p2NextRod: false, p2PrevRod: false,
}

export function useControls() {
  const keys = useRef<Controls>({ ...initial })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = keys.current
      switch (e.code) {
        case 'KeyA': k.p1Left = true; break
        case 'KeyD': k.p1Right = true; break
        case 'KeyW': k.p1SpinFwd = true; break
        case 'KeyS': k.p1SpinBack = true; break
        case 'KeyQ': k.p1PrevRod = true; break
        case 'KeyE': k.p1NextRod = true; break
        case 'ArrowLeft': k.p2Left = true; e.preventDefault(); break
        case 'ArrowRight': k.p2Right = true; e.preventDefault(); break
        case 'ArrowUp': k.p2SpinFwd = true; e.preventDefault(); break
        case 'ArrowDown': k.p2SpinBack = true; e.preventDefault(); break
        case 'Comma': k.p2PrevRod = true; break
        case 'Period': k.p2NextRod = true; break
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = keys.current
      switch (e.code) {
        case 'KeyA': k.p1Left = false; break
        case 'KeyD': k.p1Right = false; break
        case 'KeyW': k.p1SpinFwd = false; break
        case 'KeyS': k.p1SpinBack = false; break
        case 'KeyQ': k.p1PrevRod = false; break
        case 'KeyE': k.p1NextRod = false; break
        case 'ArrowLeft': k.p2Left = false; break
        case 'ArrowRight': k.p2Right = false; break
        case 'ArrowUp': k.p2SpinFwd = false; break
        case 'ArrowDown': k.p2SpinBack = false; break
        case 'Comma': k.p2PrevRod = false; break
        case 'Period': k.p2NextRod = false; break
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  return keys
}
