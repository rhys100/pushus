import { PUSHUS_LOGO_FILL, PUSHUS_LOGO_PATH } from '../../functions/_shared/pushusLogo'

/**
 * The shareable "new personal record" card, as a self-contained SVG.
 *
 * Two constraints shape this and are easy to break by accident:
 *
 *  - It must reference NOTHING external. Rasterising happens by loading the
 *    SVG into an <img>, which runs in an isolated document that fetches no
 *    subresources and inherits none of the page's fonts. An external image or
 *    an @import would also taint the canvas and make toBlob throw.
 *  - So the font is the literal system stack rather than the app's
 *    `var(--font-display)`, matching what ogImageTemplate already does. The
 *    shared PNG will therefore look slightly different from the app's own type.
 */

export const PR_CARD_WIDTH = 1080
export const PR_CARD_HEIGHT = 1080

const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const LOGO_VIEWBOX_WIDTH = 48
const LOGO_SCALE = 2.5
const LOGO_WIDTH = LOGO_VIEWBOX_WIDTH * LOGO_SCALE

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export type PrCardInput = {
  count: number
  previousBest: number
  displayName: string
  appName?: string
}

export function buildPrCardSvg({
  count,
  previousBest,
  displayName,
  appName = 'PushUS',
}: PrCardInput): string {
  const gain = Math.max(0, count - previousBest)
  const name = escapeXml(displayName.trim() || 'Someone')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PR_CARD_WIDTH}" height="${PR_CARD_HEIGHT}" viewBox="0 0 ${PR_CARD_WIDTH} ${PR_CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#12141c"/>
      <stop offset="100%" stop-color="#0a0a0d"/>
    </linearGradient>
  </defs>

  <rect width="${PR_CARD_WIDTH}" height="${PR_CARD_HEIGHT}" fill="url(#bg)"/>

  <text x="540" y="250" text-anchor="middle" fill="#94a3b8" font-family="${FONT_STACK}" font-size="40" font-weight="600" letter-spacing="8">NEW PERSONAL RECORD</text>

  <text x="540" y="560" text-anchor="middle" fill="${PUSHUS_LOGO_FILL}" font-family="${FONT_STACK}" font-size="320" font-weight="800">${count}</text>
  <text x="540" y="640" text-anchor="middle" fill="#f1f5f9" font-family="${FONT_STACK}" font-size="56" font-weight="700">push-ups in one set</text>

  <text x="540" y="740" text-anchor="middle" fill="#94a3b8" font-family="${FONT_STACK}" font-size="36" font-weight="500">${
    gain > 0 ? `${gain} more than my old best of ${previousBest}` : `Matching my best of ${previousBest}`
  }</text>

  <text x="540" y="840" text-anchor="middle" fill="#f1f5f9" font-family="${FONT_STACK}" font-size="44" font-weight="700">${name}</text>

  <!-- Logo is 48x46 in its own viewBox. At scale ${LOGO_SCALE} it is
       ${LOGO_WIDTH}px wide, so x must be (540 - ${LOGO_WIDTH} / 2) to sit on
       the card's centre line — the other elements centre via text-anchor, this
       one cannot. -->
  <g transform="translate(${(PR_CARD_WIDTH - LOGO_WIDTH) / 2} 890) scale(${LOGO_SCALE})">
    <path fill="${PUSHUS_LOGO_FILL}" d="${PUSHUS_LOGO_PATH}"/>
  </g>
  <text x="540" y="1030" text-anchor="middle" fill="#64748b" font-family="${FONT_STACK}" font-size="30" font-weight="600" letter-spacing="4">${escapeXml(appName.toUpperCase())}</text>
</svg>`
}

export function prShareText(count: number): string {
  return `New personal record: ${count} push-ups in one set 💪`
}

export function prCardFilename(count: number): string {
  return `pushus-pr-${count}.png`
}
