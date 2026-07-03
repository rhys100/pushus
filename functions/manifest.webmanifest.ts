import {
  buildWebAppManifestForOrigin,
  manifestResponse,
} from './_shared/webAppManifest.ts'

type PagesContext = {
  request: Request
}

export const onRequest = ({ request }: PagesContext): Response => {
  const origin = new URL(request.url).origin
  return manifestResponse(buildWebAppManifestForOrigin(origin))
}
