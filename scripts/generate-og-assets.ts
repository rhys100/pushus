import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { buildDefaultOgSvg, OG_HEIGHT, OG_WIDTH } from '../functions/_shared/ogImageTemplate.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ogDir = path.join(root, 'public', 'og')

mkdirSync(ogDir, { recursive: true })

const svg = buildDefaultOgSvg()
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: OG_WIDTH },
})
const pngData = resvg.render()
const pngBuffer = pngData.asPng()

const defaultPath = path.join(ogDir, 'default.png')
const aliasPath = path.join(root, 'public', 'og-image.png')

writeFileSync(defaultPath, pngBuffer)
copyFileSync(defaultPath, aliasPath)

console.log(`Generated ${defaultPath} (${OG_WIDTH}x${OG_HEIGHT})`)
