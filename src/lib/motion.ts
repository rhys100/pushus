/** Shared motion helpers — pair with the vocabulary in styles/motion.css. */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Ease-out cubic (fast start, gentle settle) for JS-driven animation. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
