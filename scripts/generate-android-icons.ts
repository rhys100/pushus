import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { buildPwaIconSvg } from '../functions/_shared/pwaIconSvg.ts'

/**
 * Android launcher icons for the TWA wrapper, rendered from the same SVG source
 * as the PWA icons so the installed app and the Home Screen icon can never drift.
 *
 * Two sets are emitted per density:
 *  - ic_launcher_foreground — the adaptive-icon foreground (API 26+). Adaptive
 *    icons are mask-cropped by the launcher, so this uses the same inset as the
 *    maskable PWA icon rather than the tighter standard one.
 *  - ic_launcher — the legacy square icon for pre-API-26 launchers.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res')

/** Launcher icons are 48dp; the foreground layer is 108dp. */
const DENSITIES = [
  { dir: 'mipmap-mdpi', scale: 1 },
  { dir: 'mipmap-hdpi', scale: 1.5 },
  { dir: 'mipmap-xhdpi', scale: 2 },
  { dir: 'mipmap-xxhdpi', scale: 3 },
  { dir: 'mipmap-xxxhdpi', scale: 4 },
] as const

const LEGACY_BASE_DP = 48
const ADAPTIVE_BASE_DP = 108

function writePng(dir: string, fileName: string, svg: string, size: number): void {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  writeFileSync(path.join(dir, fileName), resvg.render().asPng())
}

for (const { dir, scale } of DENSITIES) {
  const densityDir = path.join(resDir, dir)
  mkdirSync(densityDir, { recursive: true })

  const legacySize = Math.round(LEGACY_BASE_DP * scale)
  const adaptiveSize = Math.round(ADAPTIVE_BASE_DP * scale)

  writePng(densityDir, 'ic_launcher.png', buildPwaIconSvg(legacySize, 0.72), legacySize)
  writePng(
    densityDir,
    'ic_launcher_foreground.png',
    buildPwaIconSvg(adaptiveSize, 0.56, { rounded: false }),
    adaptiveSize,
  )
}

// Play Console requires a 512×512 icon alongside an uploaded bundle.
const playStoreDir = path.join(root, 'android', 'app', 'src', 'main')
mkdirSync(playStoreDir, { recursive: true })
writePng(playStoreDir, 'ic_launcher-playstore.png', buildPwaIconSvg(512, 0.72), 512)

console.log(`Generated Android launcher icons in ${resDir}`)
