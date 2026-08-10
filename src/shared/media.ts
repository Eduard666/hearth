export const MEDIA_SCHEME = 'hearth'

/**
 * Builds a URL the renderer can hand to `<img src>` for a file on the local disk.
 *
 * `file://` URLs are unusable here: the renderer is served over http:// in dev, so
 * webSecurity blocks them, and Windows paths (`C:\...`) do not survive naive string
 * concatenation into a file URL. The custom scheme is registered in src/main/media.ts.
 */
export function mediaUrl(absolutePath: string): string {
  return `${MEDIA_SCHEME}://media/?p=${encodeURIComponent(absolutePath)}`
}
