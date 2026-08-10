import { ipcMain } from 'electron'
import { getDb } from '../db'
import { importPhotos } from '../import'
import { convertHeicToJpeg, generateThumbnail } from '../heic'
import type { Photo, PlatformStatus, PhotoFilter } from '../../shared/types'

interface RawPhotoRow {
  id: number
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

  const tags = (
    db.prepare('SELECT tag FROM tags WHERE photo_id = ?').all(row.id) as { tag: string }[]
  ).map((t) => t.tag)

  const collectionIds = (
    db
      .prepare('SELECT collection_id FROM collection_photos WHERE photo_id = ?')
      .all(row.id) as { collection_id: number }[]
  ).map((c) => c.collection_id)

  const modelIds = (
    db
      .prepare('SELECT model_id FROM model_photos WHERE photo_id = ?')
      .all(row.id) as { model_id: number }[]
  ).map((m) => m.model_id)

  const platformStatuses: PlatformStatus[] = (
    db.prepare(`
      SELECT ps.destination_id, pd.name as destination_name, ps.posted, ps.posted_at
      FROM platform_statuses ps
      JOIN platform_destinations pd ON pd.id = ps.destination_id
      WHERE ps.photo_id = ?
    `).all(row.id) as {
      destination_id: number
      destination_name: string
      posted: number
      posted_at: string | null
    }[]
  ).map((s) => ({
    destinationId: s.destination_id,
    destinationName: s.destination_name,
    posted: s.posted === 1,
    postedAt: s.posted_at
  }))

  return {
    id: row.id,
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
    tags,
    collectionIds,
    modelIds,
    platformStatuses
  }
}

export function registerPhotoHandlers(): void {
  const db = getDb()

  ipcMain.handle('photos:import', async (_e, paths: string[]) => {
    return importPhotos(paths)
  })

  ipcMain.handle('photos:get', async (_e, filter?: PhotoFilter) => {
    let sql = 'SELECT * FROM photos WHERE 1=1'
    const params: (string | number)[] = []

    if (filter?.folderPath) {
      sql += ' AND file_path LIKE ?'
      params.push(`${filter.folderPath}%`)
    }
    if (filter?.collectionId != null) {
      sql += ' AND id IN (SELECT photo_id FROM collection_photos WHERE collection_id = ?)'
      params.push(filter.collectionId)
    }
    if (filter?.modelId != null) {
      sql += ' AND id IN (SELECT photo_id FROM model_photos WHERE model_id = ?)'
      params.push(filter.modelId)
    }
    if (filter?.tags && filter.tags.length > 0) {
      const placeholders = filter.tags.map(() => '?').join(',')
      sql += ` AND id IN (SELECT photo_id FROM tags WHERE tag IN (${placeholders}) GROUP BY photo_id HAVING COUNT(DISTINCT tag) = ?)`
      params.push(...filter.tags, filter.tags.length)
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

  ipcMain.handle('photos:convertHeic', async (_e, photoId: number, format: 'jpeg' | 'png') => {
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as RawPhotoRow | undefined
    if (!row) throw new Error('Photo not found')

    const convertedPath = await convertHeicToJpeg(row.file_path, format)
    const thumbPath = await generateThumbnail(convertedPath)

    db.prepare('UPDATE photos SET converted_path = ?, thumbnail_path = ? WHERE id = ?').run(
      convertedPath,
      thumbPath,
      photoId
    )

    const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as RawPhotoRow
    return rowToPhoto(updated)
  })

  // tags
  ipcMain.handle('tags:add', async (_e, photoIds: number[], tag: string) => {
    const insert = db.prepare('INSERT OR IGNORE INTO tags (photo_id, tag) VALUES (?, ?)')
    const tx = db.transaction(() => {
      for (const id of photoIds) insert.run(id, tag.trim().toLowerCase())
    })
    tx()
  })

  ipcMain.handle('tags:remove', async (_e, photoIds: number[], tag: string) => {
    const del = db.prepare('DELETE FROM tags WHERE photo_id = ? AND tag = ?')
    const tx = db.transaction(() => {
      for (const id of photoIds) del.run(id, tag.trim().toLowerCase())
    })
    tx()
  })

  ipcMain.handle('tags:getAll', async () => {
    const rows = db.prepare('SELECT DISTINCT tag FROM tags ORDER BY tag').all() as { tag: string }[]
    return rows.map((r) => r.tag)
  })

  // platform status
  ipcMain.handle(
    'platform:setPosted',
    async (_e, photoIds: number[], destinationId: number, posted: boolean) => {
      const upsert = db.prepare(`
        INSERT INTO platform_statuses (photo_id, destination_id, posted, posted_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(photo_id, destination_id) DO UPDATE SET posted = excluded.posted, posted_at = excluded.posted_at
      `)
      const postedAt = posted ? new Date().toISOString() : null
      const tx = db.transaction(() => {
        for (const id of photoIds) upsert.run(id, destinationId, posted ? 1 : 0, postedAt)
      })
      tx()
    }
  )

  ipcMain.handle('platform:getDestinations', async () => {
    return db.prepare('SELECT * FROM platform_destinations ORDER BY name').all()
  })

  ipcMain.handle('platform:addDestination', async (_e, name: string, color: string) => {
    const result = db
      .prepare('INSERT INTO platform_destinations (name, color, icon) VALUES (?, ?, ?)')
      .run(name.trim(), color, 'globe')
    return db.prepare('SELECT * FROM platform_destinations WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('platform:deleteDestination', async (_e, id: number) => {
    db.prepare('DELETE FROM platform_destinations WHERE id = ?').run(id)
  })
}
