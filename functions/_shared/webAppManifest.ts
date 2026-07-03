export type WebAppManifest = {
  id?: string
  name?: string
  short_name?: string
  description?: string
  start_url?: string
  scope?: string
  display?: string
  launch_handler?: { client_mode?: string }
  protocol_handlers?: Array<{ protocol?: string; url?: string }>
  background_color?: string
  theme_color?: string
  orientation?: string
  lang?: string
  categories?: string[]
  prefer_related_applications?: boolean
  related_applications?: Array<{ platform?: string; url?: string; id?: string }>
  icons?: Array<{ src?: string; sizes?: string; type?: string; purpose?: string }>
}

/** Base manifest copied from public/manifest.json — keep in sync when fields change. */
export const BASE_WEB_APP_MANIFEST: WebAppManifest = {
  id: '/',
  name: 'PushUS',
  short_name: 'PushUS',
  description: 'Bank push-ups with your mates. Privacy-first push-up challenge app.',
  start_url: '/today?source=pwa',
  scope: '/',
  display: 'standalone',
  launch_handler: {
    client_mode: 'navigate-new',
  },
  protocol_handlers: [
    {
      protocol: 'web+pushus',
      url: '/today?source=open-app&h=%s',
    },
  ],
  background_color: '#0b1220',
  theme_color: '#0b1220',
  orientation: 'portrait-primary',
  lang: 'en-AU',
  categories: ['fitness', 'health', 'social'],
  prefer_related_applications: false,
  related_applications: [
    {
      platform: 'webapp',
      url: '/manifest.json',
      id: '/',
    },
  ],
  icons: [
    {
      src: '/pwa/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa/maskable-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/pwa/maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

export function buildWebAppManifestForOrigin(origin: string): WebAppManifest {
  const normalizedOrigin = origin.replace(/\/$/, '')
  const manifestUrl = `${normalizedOrigin}/manifest.json`

  return {
    ...BASE_WEB_APP_MANIFEST,
    related_applications: [
      {
        platform: 'webapp',
        url: manifestUrl,
        id: '/',
      },
    ],
  }
}

export function manifestResponse(manifest: WebAppManifest): Response {
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
    },
  })
}
