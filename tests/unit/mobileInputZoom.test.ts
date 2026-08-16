import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * iOS Safari zooms the whole page when a focused form control is smaller than
 * 16px, and has ignored `user-scalable=no` since iOS 10 — so CSS is the only
 * lever. The app's inputs are `text-sm` (14px), which meant tapping the email
 * field on an iPhone zoomed in and shoved the field under the keyboard. A real
 * user reported it as simply not being able to type their email.
 *
 * This guards the rule rather than the symptom, because the symptom only
 * reproduces on real WebKit and no test here runs that.
 */
describe('mobile form controls avoid iOS focus zoom', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

  const block = css.match(/@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?\n {2}}/)?.[0]

  it('raises input font-size to at least 16px on touch devices', () => {
    expect(block, 'the coarse-pointer media block is missing').toBeTruthy()
    expect(block).toMatch(/font-size:\s*max\(16px/)
  })

  it('covers select and textarea too, not just input', () => {
    expect(block).toMatch(/\binput\b/)
    expect(block).toMatch(/\bselect\b/)
    expect(block).toMatch(/\btextarea\b/)
  })

  it('leaves checkboxes, radios and ranges alone', () => {
    // These have no text to zoom toward, and forcing a font-size on them can
    // change the rendered control size on some engines.
    for (const type of ['checkbox', 'radio', 'range']) {
      expect(block).toContain(`:not([type='${type}'])`)
    }
  })

  it('is scoped to coarse pointers so desktop keeps the designed density', () => {
    expect(block).toContain('pointer: coarse')
    expect(block).toContain('hover: none')
  })
})
