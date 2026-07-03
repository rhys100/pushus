import { describe, expect, it } from 'vitest'
import { buildWebAppManifestForOrigin } from '../../functions/_shared/webAppManifest.ts'

describe('web app manifest origin', () => {
  it('uses an absolute manifest URL for getInstalledRelatedApps', () => {
    const manifest = buildWebAppManifestForOrigin('https://pushus.app')

    expect(manifest.related_applications).toEqual([
      {
        platform: 'webapp',
        url: 'https://pushus.app/manifest.json',
        id: '/',
      },
    ])
  })

  it('supports www and apex origins independently', () => {
    const www = buildWebAppManifestForOrigin('https://www.pushus.app')
    const apex = buildWebAppManifestForOrigin('https://pushus.app')

    expect(www.related_applications?.[0]?.url).toBe('https://www.pushus.app/manifest.json')
    expect(apex.related_applications?.[0]?.url).toBe('https://pushus.app/manifest.json')
  })
})
