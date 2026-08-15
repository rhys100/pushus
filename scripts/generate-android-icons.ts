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
 *  - ic_launcher_foreground — the adaptive-icon foreground layer (API 26+).
 *  - ic_launcher — the legacy square icon for pre-API-26 launchers.
 *
 * Adaptive-icon geometry is the whole reason the foreground is not just the
 * maskable PWA icon:
 *
 *   - the foreground layer is a 108dp canvas,
 *   - the launcher mask crops it to the centre 72dp (everything outside is
 *     reserved for the mask shape and parallax),
 *   - so artwork must sit well inside that 72dp or it reads as edge-to-edge.
 *
 * A maskable PWA icon assumes a far more generous 80%-of-canvas safe zone, so
 * reusing its inset here made the bolt fill almost the entire visible circle.
 * FOREGROUND_SCALE puts the logo at ~42dp inside the 72dp visible area.
 *
 * The foreground must also be TRANSPARENT: the launcher composites it over the
 * separate background layer (@color/ic_launcher_background). Painting a
 * background into the foreground produces a hard square that the mask then
 * crops, which is what made the icon look unfinished on the home screen.
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

/**
 * ~48dp of logo inside the 72dp the launcher mask actually shows — Material's
 * own keyline for a full-bleed glyph. Previously 0.56, which pushed the bolt
 * hard against the mask edge and clipped it on circular launchers.
 */
const FOREGROUND_SCALE = 0.44
/** Legacy icons are drawn unmasked at 48dp, so they can run closer to the edge. */
const LEGACY_SCALE = 0.72

function writePng(dir: string, fileName: string, svg: string, size: number): void {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  writeFileSync(path.join(dir, fileName), resvg.render().asPng())
}

for (const { dir, scale } of DENSITIES) {
  const densityDir = path.join(resDir, dir)
  mkdirSync(densityDir, { recursive: true })

  const legacySize = Math.round(LEGACY_BASE_DP * scale)
  const adaptiveSize = Math.round(ADAPTIVE_BASE_DP * scale)

  writePng(densityDir, 'ic_launcher.png', buildPwaIconSvg(legacySize, LEGACY_SCALE), legacySize)
  writePng(
    densityDir,
    'ic_launcher_foreground.png',
    // `background: 'none'` leaves the rect unpainted, so the layer is
    // transparent and the launcher's own mask + background layer show through.
    buildPwaIconSvg(adaptiveSize, FOREGROUND_SCALE, { rounded: false, background: 'none' }),
    adaptiveSize,
  )
}

// Play Console requires a 512×512 icon alongside an uploaded bundle.
const playStoreDir = path.join(root, 'android', 'app', 'src', 'main')
mkdirSync(playStoreDir, { recursive: true })
writePng(playStoreDir, 'ic_launcher-playstore.png', buildPwaIconSvg(512, 0.72), 512)

console.log(`Generated Android launcher icons in ${resDir}`)
