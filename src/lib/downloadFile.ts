/**
 * Handing the user a file. There was no helper for this anywhere in src — the
 * export and share-card features each wanted their own, so it lives here once.
 *
 * The share-then-download ladder matters on mobile: iOS Safari has no visible
 * filesystem, so an anchor download is close to useless there while the share
 * sheet is exactly right. Desktop is the opposite.
 */

export type ShareableFile = {
  blob: Blob
  filename: string
  /** Shown above the share sheet on platforms that display one. */
  title?: string
  text?: string
}

/** Plain download via a temporary object URL. Always available. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Revoking synchronously can cancel the download in Safari; one frame is enough.
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

/**
 * True when this browser can share this exact file. `navigator.share` alone is
 * not enough to go on — Android Chrome exposes it while refusing file payloads,
 * so the file must be offered to `canShare` itself.
 */
export function canShareFile(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [file] })
  )
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Share the file if the platform genuinely supports it, otherwise download it.
 *
 * The Blob must already exist before calling this from a click handler: iOS
 * requires `navigator.share` to run inside the gesture that triggered it, and
 * awaiting blob generation first spends the user activation, after which the
 * share sheet silently never appears.
 */
export async function shareOrDownloadFile({
  blob,
  filename,
  title,
  text,
}: ShareableFile): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type })

  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title, text })
      return 'shared'
    } catch (error) {
      // A user dismissing the sheet is an AbortError and is not a failure —
      // falling back to a download there would be obnoxious.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      // Anything else (permission, unsupported payload) falls through.
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}
