export function isSocialCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('twitterbot') ||
    ua.includes('slackbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('whatsapp') ||
    ua.includes('telegrambot') ||
    ua.includes('discordbot') ||
    ua.includes('googlebot') ||
    ua.includes('embedly') ||
    ua.includes('pinterest') ||
    ua.includes('applebot') ||
    /\bot\b/.test(ua) ||
    ua.includes('crawler') ||
    ua.includes('spider')
  )
}

export function buildInviteOgImageUrl(appUrl: string, inviteCode: string): string {
  const base = appUrl.replace(/\/$/, '')
  return `${base}/og/join/${encodeURIComponent(inviteCode)}.png`
}

type InviteOgHtmlOptions = {
  appName: string
  appUrl: string
  inviteCode: string
  groupName: string | null
  ogImageUrl: string
  description?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildInviteOgHtml({
  appName,
  appUrl,
  inviteCode,
  groupName,
  ogImageUrl,
  description = "Bank push-ups with your mates. Privacy-first push-up challenge app.",
}: InviteOgHtmlOptions): string {
  const pageUrl = `${appUrl.replace(/\/$/, '')}/join/${encodeURIComponent(inviteCode)}`
  const title = groupName
    ? `Join ${groupName} on ${appName}`
    : `Join a group on ${appName}`
  const imageAlt = groupName
    ? `Join ${groupName} on ${appName}`
    : `Join a group on ${appName}`

  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(appName)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}" />
  </head>
  <body>
    <p><a href="${escapeHtml(pageUrl)}">Continue to ${escapeHtml(appName)}</a></p>
  </body>
</html>`
}
