import { app, net, protocol } from 'electron'
import { existsSync } from 'fs'
import { resolve, sep } from 'path'
import { pathToFileURL } from 'url'
import { getDb } from './db'
import { MEDIA_SCHEME } from '../shared/media'

/** Must run before `app.whenReady()` - privileges cannot be changed afterwards. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
}

/** Must run after `app.whenReady()`. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let target: string | null
    try {
      target = new URL(request.url).searchParams.get('p')
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    if (!target) return new Response('Missing path', { status: 400 })

    const absolute = resolve(target)
    if (!isServable(absolute)) return new Response('Forbidden', { status: 403 })
    if (!existsSync(absolute)) return new Response('Not found', { status: 404 })

    return net.fetch(pathToFileURL(absolute).toString())
  })
}

/**
 * Only files Hearth manages are servable: anything under userData (library copies,
 * converted images, thumbnails) plus paths recorded in the photos table, which is how
 * "reference" import mode keeps images where the user put them.
 */
function isServable(absolutePath: string): boolean {
  const userData = resolve(app.getPath('userData'))
  if (absolutePath === userData || absolutePath.startsWith(userData + sep)) return true

  try {
    const row = getDb()
      .prepare(
        `SELECT 1 FROM photos
         WHERE file_path = ? OR converted_path = ? OR thumbnail_path = ?
         LIMIT 1`
      )
      .get(absolutePath, absolutePath, absolutePath)
    return row != null
  } catch {
    return false
  }
}
