import { useLayoutEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * FLIP reordering for a list container: children carrying `data-flip-key`
 * glide to their new vertical position whenever `signal` changes, instead of
 * teleporting. Uses offsetTop (scroll-independent) and the Web Animations
 * API, so there's nothing to clean up and interrupted moves retarget cleanly.
 */
export function useFlipList<T extends HTMLElement>(signal: unknown) {
  const containerRef = useRef<T | null>(null)
  const positions = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-flip-key]'),
    )
    const prev = positions.current
    const next = new Map<string, number>()
    const reduced = prefersReducedMotion()

    for (const item of items) {
      const key = item.dataset.flipKey
      if (!key) {
        continue
      }

      const top = item.offsetTop
      next.set(key, top)

      const prevTop = prev.get(key)
      if (!reduced && prevTop != null && Math.abs(prevTop - top) > 1) {
        item.animate(
          [
            { transform: `translateY(${prevTop - top}px)` },
            { transform: 'translateY(0)' },
          ],
          { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        )
      }
    }

    positions.current = next
  }, [signal])

  return containerRef
}
