import {
  PUSHUS_ICON_BACKGROUND,
  PUSHUS_LOGO_FILL,
  PUSHUS_LOGO_PATH,
  PUSHUS_LOGO_VIEWBOX_HEIGHT,
  PUSHUS_LOGO_VIEWBOX_WIDTH,
} from './pushusLogo.ts'

type BuildIconSvgOptions = {
  background?: string
  logoFill?: string
  /** Maskable icons use a full-bleed square; "any" icons use rounded corners. */
  rounded?: boolean
}

function logoTransform(size: number, iconScale: number): { x: number; y: number; scale: number } {
  const iconWidth = size * iconScale
  const iconHeight = iconWidth * (PUSHUS_LOGO_VIEWBOX_HEIGHT / PUSHUS_LOGO_VIEWBOX_WIDTH)
  const x = (size - iconWidth) / 2
  const y = (size - iconHeight) / 2
  const scale = iconWidth / PUSHUS_LOGO_VIEWBOX_WIDTH

  return { x, y, scale }
}

export function buildPwaIconSvg(
  size: number,
  iconScale: number,
  options: BuildIconSvgOptions = {},
): string {
  const background = options.background ?? PUSHUS_ICON_BACKGROUND
  const logoFill = options.logoFill ?? PUSHUS_LOGO_FILL
  const rounded = options.rounded ?? true
  const { x, y, scale } = logoTransform(size, iconScale)
  const backgroundRect = rounded
    ? `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${background}"/>`
    : `<rect width="${size}" height="${size}" fill="${background}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${backgroundRect}
  <g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
    <path fill="${logoFill}" d="${PUSHUS_LOGO_PATH}"/>
  </g>
</svg>`
}

export function buildPwaBadgeSvg(size: number): string {
  const { x, y, scale } = logoTransform(size, 0.64)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
    <path fill="#ffffff" d="${PUSHUS_LOGO_PATH}"/>
  </g>
</svg>`
}
