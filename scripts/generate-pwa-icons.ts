import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const THEME_BG = '#0b1220'
const FAVICON_VIEWBOX_WIDTH = 48
const FAVICON_VIEWBOX_HEIGHT = 46

const ICON_SPECS = [
  { fileName: 'apple-touch-icon-180.png', size: 180, contentScale: 0.58 },
  { fileName: 'icon-192.png', size: 192, contentScale: 0.58 },
  { fileName: 'icon-512.png', size: 512, contentScale: 0.58 },
  { fileName: 'icon-512-maskable.png', size: 512, contentScale: 0.42 },
] as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const iconsDir = path.join(root, 'public', 'icons')
const faviconPath = path.join(root, 'public', 'favicon.svg')

function extractFaviconInner(svg: string): string {
  const openTagEnd = svg.indexOf('>')
  const closeTagStart = svg.lastIndexOf('</svg>')

  if (openTagEnd === -1 || closeTagStart === -1) {
    throw new Error('Could not parse favicon.svg')
  }

  return svg.slice(openTagEnd + 1, closeTagStart)
}

function buildSquareIconSvg(size: number, contentScale: number, inner: string): string {
  const contentWidth = size * contentScale
  const contentHeight = (contentWidth * FAVICON_VIEWBOX_HEIGHT) / FAVICON_VIEWBOX_WIDTH
  const offsetX = (size - contentWidth) / 2
  const offsetY = (size - contentHeight) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${THEME_BG}" />
  <g transform="translate(${offsetX} ${offsetY}) scale(${contentWidth / FAVICON_VIEWBOX_WIDTH})">
    ${inner}
  </g>
</svg>`
}

mkdirSync(iconsDir, { recursive: true })

const faviconInner = extractFaviconInner(readFileSync(faviconPath, 'utf8'))

for (const spec of ICON_SPECS) {
  const svg = buildSquareIconSvg(spec.size, spec.contentScale, faviconInner)
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: spec.size },
    background: THEME_BG,
  })
  const pngBuffer = resvg.render().asPng()
  const outputPath = path.join(iconsDir, spec.fileName)
  writeFileSync(outputPath, pngBuffer)
  console.log(`Generated ${outputPath} (${spec.size}x${spec.size})`)
}
