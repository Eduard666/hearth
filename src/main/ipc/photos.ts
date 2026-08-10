import { ipcMain } from 'electron'
import { getDb } from '../db'
import { importPhotos } from '../import'
import { backfillThumbnails, buildPhotoAssets, persistPhotoAssets } from '../thumbnails'
import type { Photo, PhotoPost, PhotoFilter } from '../../shared/types'

interface RawPhotoRow {
  id: number
  model_id: number
  file_path: string
  sha256: string
  perceptual_hash: string
  width: number
  height: number
  file_size: number
  import_date: string
  original_ext: string
  converted_path: string | null
  thumbnail_path: string | null
}

function rowToPhoto(row: RawPhotoRow): Photo {
  const db = getDb()

  const collectionIds = (
    db
      .prepare('SELECT collection_id FROM collection_photos WHERE photo_id = ?')
      .all(row.id) as { collection_id: number }[]
  ).map((c) => c.collection_id)

  const posts: PhotoPost[] = (
    db.prepare(`
      SELECT pp.tag_id, t.name AS tag_name, t.color AS tag_color, pp.posted_at
      FROM photo_posts pp
      JOIN tags t ON t.id = pp.tag_id
      WHERE pp.photo_id = ?
      ORDER BY pp.posted_at DESC
    `).all(row.id) as {
      tag_id: number
      tag_name: string
      tag_color: string
      posted_at: string
    }[]
  ).map((p) => ({
    tagId: p.tag_id,
    tagName: p.tag_name,
    tagColor: p.tag_color,
    postedAt: p.posted_at
  }))

  return {
    id: row.id,
    modelId: row.model_id,
    filePath: row.file_path,
    sha256: row.sha256,
    perceptualHash: row.perceptual_hash,
    width: row.width,
    height: row.height,
    fileSize: row.file_size,
    importDate: row.import_date,
    originalExt: row.original_ext,
    convertedPath: row.converted_path,
    thumbnailPath: row.thumbnail_path,
    collectionIds,
    posts
  }
}

export function registerPhotoHandlers(): void {
  const db = getDb()

  ipcMain.handle('photos:import', async (_e, paths: string[], modelId: number) => {
    return importPhotos(paths, modelId)
  })

  ipcMain.handle('photos:get', async (_e, filter?: PhotoFilter) => {
    // Photos are only ever reachable through a model; there is no global library view.
    if (filter?.modelId == null) return []

    let sql = 'SELECT * FROM photos WHERE model_id = ?'
    const params: (string | number)[] = [filter.modelId]

    if (filter.collectionId != null) {
      sql += ' AND id IN (SELECT photo_id FROM collection_photos WHERE collection_id = ?)'
      params.push(filter.collectionId)
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      const placeholders = filter.tagIds.map(() => '?').join(',')
      sql += ` AND id IN (SELECT photo_id FROM photo_posts WHERE tag_id IN (${placeholders}))`
      params.push(...filter.tagIds)
    }
    if (filter.postedOnly) {
      sql += ' AND id IN (SELECT photo_id FROM photo_posts)'
    }

    sql += ' ORDER BY import_date DESC'

    const rows = db.prepare(sql).all(...params) as RawPhotoRow[]
    return rows.map(rowToPhoto)
  })

  ipcMain.handle('photos:getOne', async (_e, id: number) => {
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as RawPhotoRow | undefined
    return row ? rowToPhoto(row) : null
  })

  ipcMain.handle('photos:delete', async (_e, id: number) => {
    db.prepare('DELETE FROM photos WHERE id = ?').run(id)
  })

  ipcMain.handle('photos:convertHeic', async (_e, photoId: number) => {
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as RawPhotoRow | undefined
    if (!row) throw new Error('Photo not found')

    const assets = await buildPhotoAssets(row)
    if (!assets) throw new Error(`Could not decode ${row.file_path}`)
    persistPhotoAssets(photoId, assets)

    const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as RawPhotoRow
    return rowToPhoto(updated)
  })

  ipcMain.handle('photos:rebuildThumbnails', async () => {
    void backfillThumbnails()
  })
}
