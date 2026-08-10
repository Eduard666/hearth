import { BrowserWindow, app, nativeImage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import Jimp from 'jimp'
import { getDb } from './db'
import { computePerceptualHash } from './hash'
import { decodeHeic, isHeicFile, writeConverted } from './heic'
import type { PhotoAssets } from '../shared/types'

const THUMB_MAX = 400
const THUMB_QUALITY = 80

export interface PhotoAssetRow {
  id: number
  file_path: string
  converted_path: string | null
  thumbnail_path: string | null
  perceptual_hash?: string | null
}

const EMPTY_PHASH = '0'.repeat(64)

function thumbnailDir(): string {
  const dir = join(app.getPath('userData'), 'thumbnails')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Produces the derived assets a photo needs to be displayable: a full-size decode for
 * formats Chromium cannot render (HEIC), and a small JPEG thumbnail for the grid.
 *
 * Returns null when the source file is gone or cannot be decoded at all.
 */
export async function buildPhotoAssets(row: PhotoAssetRow): Promise<PhotoAssets | null> {
  const hasConverted = row.converted_path != null && existsSync(row.converted_path)
  const source = hasConverted ? row.converted_path! : row.file_path
  if (!existsSync(source)) return null

  let convertedPath = hasConverted ? row.converted_path! : null
  let data: Buffer

  try {
    if (!hasConverted && isHeicFile(source)) {
      // Chromium cannot decode HEIC, so the decoded copy is what actually gets displayed.
      data = await decodeHeic(source, 'jpeg')
      convertedPath = writeConverted(source, data, 'jpeg', row.id)
    } else {
      data = readFileSync(source)
    }
  } catch (err) {
    console.error(`[thumbnails] decode failed for photo ${row.id}:`, err)
    return null
  }

  const thumbnailPath = join(thumbnailDir(), `thumb_${row.id}.jpg`)

  try {
    return { ...writeThumbnailNative(data, thumbnailPath), convertedPath, thumbnailPath }
  } catch {
    // nativeImage only handles PNG/JPEG; fall back to Jimp for webp/gif/bmp/tiff.
  }

  try {
    const image = await Jimp.read(data)
    const width = image.bitmap.width
    const height = image.bitmap.height
    image.scaleToFit(THUMB_MAX, THUMB_MAX)
    image.quality(THUMB_QUALITY)
    await image.writeAsync(thumbnailPath)
    return { width, height, convertedPath, thumbnailPath }
  } catch (err) {
    console.error(`[thumbnails] thumbnail failed for photo ${row.id}:`, err)
    return null
  }
}

function writeThumbnailNative(
  data: Buffer,
  thumbnailPath: string
): { width: number; height: number } {
  const image = nativeImage.createFromBuffer(data)
  if (image.isEmpty()) throw new Error('unsupported by nativeImage')

  const { width, height } = image.getSize()
  const scaled =
    width <= THUMB_MAX && height <= THUMB_MAX
      ? image
      : image.resize(
          width >= height ? { width: THUMB_MAX, quality: 'good' } : { height: THUMB_MAX, quality: 'good' }
        )

  writeFileSync(thumbnailPath, scaled.toJPEG(THUMB_QUALITY))
  return { width, height }
}

export function persistPhotoAssets(photoId: number, assets: PhotoAssets): void {
  getDb()
    .prepare(
      `UPDATE photos
       SET thumbnail_path = ?, converted_path = ?, width = ?, height = ?
       WHERE id = ?`
    )
    .run(assets.thumbnailPath, assets.convertedPath, assets.width, assets.height, photoId)
}

let backfilling = false

/**
 * Fills in derived assets for every photo missing them, one at a time, yielding between
 * photos so IPC stays responsive. HEIC decoding is pure JS and costs ~1s per image, so
 * this is deliberately incremental: each finished photo is pushed to the renderer as it
 * lands rather than making the user wait for the whole library.
 */
export async function backfillThumbnails(): Promise<void> {
  if (backfilling) return
  backfilling = true

  try {
    const db = getDb()
    const rows = db
      .prepare(
        'SELECT id, file_path, converted_path, thumbnail_path, perceptual_hash FROM photos ORDER BY id'
      )
      .all() as PhotoAssetRow[]

    const pending = rows.filter((r) => !r.thumbnail_path || !existsSync(r.thumbnail_path))
    if (pending.length === 0) return

    let done = 0
    broadcastProgress({ done, total: pending.length })

    for (const row of pending) {
      const assets = await buildPhotoAssets(row)
      done++

      if (assets) {
        persistPhotoAssets(row.id, assets)
        // Formats imghash cannot open (HEIC) were stored with an empty hash at import
        // time; now that a JPEG thumbnail exists, near-duplicate detection can work.
        if (!row.perceptual_hash || row.perceptual_hash === EMPTY_PHASH) {
          const phash = await computePerceptualHash(assets.thumbnailPath)
          if (phash !== EMPTY_PHASH) {
            db.prepare('UPDATE photos SET perceptual_hash = ? WHERE id = ?').run(phash, row.id)
          }
        }
        broadcastProgress({ done, total: pending.length, photoId: row.id, assets })
      } else {
        broadcastProgress({ done, total: pending.length })
      }

      await new Promise((resolve) => setImmediate(resolve))
    }
  } catch (err) {
    console.error('[thumbnails] backfill failed:', err)
  } finally {
    backfilling = false
  }
}

interface ThumbnailProgress {
  done: number
  total: number
  photoId?: number
  assets?: PhotoAssets
}

function broadcastProgress(progress: ThumbnailProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('thumbnails:progress', progress)
  }
}
