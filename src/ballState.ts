// Shared ball state written by Ball each frame, read by AI each frame.
// Plain objects avoid React overhead for per-frame updates.
export const ballPos = { x: 0, y: 0, z: 0 }
export const ballVel = { x: 0, y: 0, z: 0 }
