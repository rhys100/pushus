import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const pwaDir = path.join(publicDir, 'pwa')

const ICON_VIEWBOX_WIDTH = 48
const ICON_VIEWBOX_HEIGHT = 46
const ICON_BACKGROUND = '#0b1220'

function readFaviconInnerSvg(): string {
  const favicon = readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8')
  const contentStart = favicon.indexOf('>')
  const contentEnd = favicon.lastIndexOf('</svg>')

  if (contentStart === -1 || contentEnd === -1 || contentEnd <= contentStart) {
    throw new Error('Could not parse public/favicon.svg')
  }

  return favicon.slice(contentStart + 1, contentEnd)
}

function buildIconSvg(size: number, iconScale: number, background = ICON_BACKGROUND): string {
  const iconWidth = size * iconScale
  const iconHeight = iconWidth * (ICON_VIEWBOX_HEIGHT / ICON_VIEWBOX_WIDTH)
  const x = (size - iconWidth) / 2
  const y = (size - iconHeight) / 2
  const scale = iconWidth / ICON_VIEWBOX_WIDTH

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${background}"/>
  <g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
    ${readFaviconInnerSvg()}
  </g>
</svg>`
}

function buildBadgeSvg(size: number): string {
  const iconWidth = size * 0.64
  const iconHeight = iconWidth * (ICON_VIEWBOX_HEIGHT / ICON_VIEWBOX_WIDTH)
  const x = (size - iconWidth) / 2
  const y = (size - iconHeight) / 2
  const scale = iconWidth / ICON_VIEWBOX_WIDTH

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="transparent"/>
  <g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
    ${readFaviconInnerSvg().replaceAll(/fill="[^"]*"/g, 'fill="#ffffff"')}
  </g>
</svg>`
}

function writePng(fileName: string, svg: string, size: number): void {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  const png = resvg.render().asPng()
  writeFileSync(path.join(pwaDir, fileName), png)
}

mkdirSync(pwaDir, { recursive: true })

writePng('icon-192.png', buildIconSvg(192, 0.72), 192)
writePng('icon-512.png', buildIconSvg(512, 0.72), 512)
writePng('maskable-192.png', buildIconSvg(192, 0.56), 192)
writePng('maskable-512.png', buildIconSvg(512, 0.56), 512)
writePng('apple-touch-icon.png', buildIconSvg(180, 0.68), 180)
writePng('notification-badge-96.png', buildBadgeSvg(96), 96)

console.log(`Generated PWA assets in ${pwaDir}`)
