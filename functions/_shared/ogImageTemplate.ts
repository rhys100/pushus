export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export const DEFAULT_TAGLINE = "Bank push-ups. Push your mates. Don't wreck yourself."
export const INVITE_SUBTITLE = "You're invited to join on PushUS"

const LOGO_PATH =
  'M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z'

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function truncateForOg(text: string, maxLen = 40): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`
}

type OgSvgOptions = {
  appName: string
  tagline?: string
  groupName?: string
}

function wrapHeadline(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word.length > maxCharsPerLine ? truncateForOg(word, maxCharsPerLine) : word
  }

  if (current) lines.push(current)
  return lines.slice(0, 2)
}

function renderHeadlineLines(
  lines: string[],
  startY: number,
  lineHeight: number,
  fontSize: number,
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="600" y="${startY + index * lineHeight}" text-anchor="middle" fill="#f1f5f9" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="700">${escapeXml(line)}</text>`,
    )
    .join('\n    ')
}

function buildOgSvg({ appName, tagline = DEFAULT_TAGLINE, groupName }: OgSvgOptions): string {
  const isInvite = Boolean(groupName?.trim())
  const headline = isInvite ? truncateForOg(groupName!.trim()) : appName
  const headlineLines = wrapHeadline(headline, isInvite ? 22 : 18)
  const headlineFontSize = isInvite ? 56 : 72
  const headlineStartY = isInvite ? 300 : 320
  const subtitle = isInvite ? INVITE_SUBTITLE : tagline

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#141c2e"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#863bff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#863bff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>
  <rect x="80" y="80" width="1040" height="470" rx="32" fill="#141c2e" fill-opacity="0.55" stroke="#1e293b" stroke-width="2"/>
  <rect x="80" y="548" width="220" height="6" rx="3" fill="#ff6b35"/>
  <g transform="translate(536 150) scale(2.2)">
    <path fill="#863bff" d="${LOGO_PATH}"/>
  </g>
  ${renderHeadlineLines(headlineLines, headlineStartY, headlineFontSize + 12, headlineFontSize)}
  <text x="600" y="${isInvite ? 410 : 420}" text-anchor="middle" fill="#94a3b8" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="32" font-weight="500">${escapeXml(subtitle)}</text>
  ${
    isInvite
      ? `<text x="600" y="470" text-anchor="middle" fill="#64748b" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="24" font-weight="500">${escapeXml(tagline)}</text>`
      : ''
  }
</svg>`
}

export function buildDefaultOgSvg(options: {
  appName?: string
  tagline?: string
} = {}): string {
  return buildOgSvg({
    appName: options.appName ?? 'PushUS',
    tagline: options.tagline ?? DEFAULT_TAGLINE,
  })
}

export function buildInviteOgSvg(options: {
  appName?: string
  groupName: string
  tagline?: string
}): string {
  return buildOgSvg({
    appName: options.appName ?? 'PushUS',
    tagline: options.tagline ?? DEFAULT_TAGLINE,
    groupName: options.groupName,
  })
}
