// Shared mutable state for mobile controls — written by MobileControls, read by Rods.
// Plain object avoids React re-render overhead for per-frame reads.
export const touchControls = {
  spinFwd:    false,  // equivalent to pressing D (kick forward)
  spinBack:   false,  // equivalent to pressing A (rotate back)
  isPortrait: false,  // updated by App when orientation changes
}
