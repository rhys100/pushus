import { twMerge } from 'tailwind-merge'

/**
 * Merge class names, dropping falsy entries. Backed by tailwind-merge so a later
 * conflicting utility reliably wins over an earlier one — e.g. a caller's
 * `min-h-10` overrides a component's base `min-h-12`, instead of both being
 * emitted and Tailwind's CSS source order (not the call order) deciding.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
