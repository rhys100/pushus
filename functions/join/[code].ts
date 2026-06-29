import {
  buildInviteOgHtml,
  buildInviteOgImageUrl,
  isSocialCrawler,
} from '../_shared/inviteOgHtml.ts'
import { readEdgeEnv, fetchInviteGroupPreview } from '../_shared/supabasePreview.ts'

type PagesContext = {
  request: Request
  env: Record<string, string | undefined>
  params: Record<string, string | undefined>
  next: () => Promise<Response>
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const userAgent = context.request.headers.get('User-Agent') ?? ''
  if (!isSocialCrawler(userAgent)) {
    return context.next()
  }

  const inviteCode = context.params.code?.trim() ?? ''
  const { supabaseUrl, supabaseAnonKey, appUrl, appName } = readEdgeEnv(context.env)

  const groupName = inviteCode
    ? await fetchInviteGroupPreview(supabaseUrl, supabaseAnonKey, inviteCode)
    : null

  const ogImageUrl = inviteCode
    ? buildInviteOgImageUrl(appUrl, inviteCode)
    : `${appUrl}/og/default.png`

  const html = buildInviteOgHtml({
    appName,
    appUrl,
    inviteCode,
    groupName,
    ogImageUrl,
  })

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
