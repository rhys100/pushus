import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { buildPwaBadgeSvg, buildPwaIconSvg } from '../functions/_shared/pwaIconSvg.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pwaDir = path.join(root, 'public', 'pwa')

function writePng(fileName: string, svg: string, size: number): void {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  const png = resvg.render().asPng()
  writeFileSync(path.join(pwaDir, fileName), png)
}

mkdirSync(pwaDir, { recursive: true })

writePng('icon-192.png', buildPwaIconSvg(192, 0.72), 192)
writePng('icon-512.png', buildPwaIconSvg(512, 0.72), 512)
writePng('maskable-192.png', buildPwaIconSvg(192, 0.56, { rounded: false }), 192)
writePng('maskable-512.png', buildPwaIconSvg(512, 0.56, { rounded: false }), 512)
writePng('apple-touch-icon.png', buildPwaIconSvg(180, 0.68), 180)
writePng('notification-badge-96.png', buildPwaBadgeSvg(96), 96)

console.log(`Generated PWA assets in ${pwaDir}`)
