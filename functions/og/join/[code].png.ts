import { buildDefaultOgSvg, buildInviteOgSvg } from '../../_shared/ogImageTemplate.ts'
import { readEdgeEnv, fetchInviteGroupPreview } from '../../_shared/supabasePreview.ts'

type PagesContext = {
  request: Request
  env: Record<string, string | undefined>
  params: Record<string, string | undefined>
}

let wasmReady: Promise<void> | null = null

async function ensureResvgWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const { initWasm, Resvg: _Resvg } = await import('@resvg/resvg-wasm')
      void _Resvg
      const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm')
      await initWasm(wasmModule.default)
    })()
  }
  await wasmReady
}

async function svgToPng(svg: string): Promise<Uint8Array> {
  await ensureResvgWasm()
  const { Resvg } = await import('@resvg/resvg-wasm')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
  return resvg.render().asPng()
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const inviteCode = context.params.code?.replace(/\.png$/i, '').trim() ?? ''
  const { supabaseUrl, supabaseAnonKey, appUrl, appName } = readEdgeEnv(context.env)

  try {
    const groupName = inviteCode
      ? await fetchInviteGroupPreview(supabaseUrl, supabaseAnonKey, inviteCode)
      : null

    if (!groupName) {
      return Response.redirect(`${appUrl}/og/default.png`, 302)
    }

    const svg = buildInviteOgSvg({ appName, groupName })
    const png = await svgToPng(svg)

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    const svg = buildDefaultOgSvg({ appName })
    try {
      const png = await svgToPng(svg)
      return new Response(png, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
        },
      })
    } catch {
      return Response.redirect(`${appUrl}/og/default.png`, 302)
    }
  }
}
