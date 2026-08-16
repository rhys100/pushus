/**
 * Rasterise a self-contained SVG string to a PNG Blob, in the browser, with no
 * dependency.
 *
 * `@resvg/resvg-wasm` is a runtime dependency of this repo and would be the
 * obvious tool — but it CANNOT run here. `public/_headers` sets
 * `script-src 'self' 'unsafe-inline'` with no `'wasm-unsafe-eval'`, so Chromium
 * refuses to compile the module, and its wasm payload is 2.4 MB besides. It is
 * for the Cloudflare functions, not the client. Canvas needs no header change:
 * `img-src 'self' data: blob:` is already allowed.
 */

/** Anything longer than this and the share sheet has been left hanging. */
const RASTERISE_TIMEOUT_MS = 10_000

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas is unavailable')
    }

    context.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        // toBlob yields null on a tainted canvas — which is what an external
        // font or image inside the SVG would cause.
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Could not render the card'))
        }
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = window.setTimeout(() => {
      image.src = ''
      reject(new Error('Timed out rendering the card'))
    }, RASTERISE_TIMEOUT_MS)

    image.onload = () => {
      window.clearTimeout(timer)
      resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Could not load the card image'))
    }

    image.src = url
  })
}
