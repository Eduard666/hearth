import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { Collection } from '../../shared/types'

interface RawCollectionRow {
  id: number
  model_id: number
  name: string
  description: string | null
  created_at: string
  photo_count: number
}

function rowToCollection(row: RawCollectionRow): Collection {
  return {
    id: row.id,
    modelId: row.model_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    photoCount: row.photo_count
  }
}

const SELECT_COLLECTION = `
  SELECT c.*, (SELECT COUNT(*) FROM collection_photos cp WHERE cp.collection_id = c.id) AS photo_count
  FROM collections c
`

export function registerCollectionHandlers(): void {
  const db = getDb()

  ipcMain.handle('collections:get', async (_e, modelId?: number) => {
    // Collections live inside a model's space; without one there is nothing to show.
    if (modelId == null) return []

    const rows = db
      .prepare(`${SELECT_COLLECTION} WHERE c.model_id = ? ORDER BY c.name COLLATE NOCASE`)
      .all(modelId) as RawCollectionRow[]
    return rows.map(rowToCollection)
  })

  ipcMain.handle(
    'collections:create',
    async (_e, modelId: number, name: string, description?: string) => {
      const model = db.prepare('SELECT id FROM models WHERE id = ?').get(modelId)
      if (!model) throw new Error(`Model ${modelId} does not exist`)

      const result = db
        .prepare(
          'INSERT INTO collections (model_id, name, description, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(modelId, name.trim(), description ?? null, new Date().toISOString())

      const row = db
        .prepare(`${SELECT_COLLECTION} WHERE c.id = ?`)
        .get(result.lastInsertRowid) as RawCollectionRow
      return rowToCollection(row)
    }
  )

  ipcMain.handle('collections:update', async (_e, id: number, name: string, description?: string) => {
    db.prepare('UPDATE collections SET name = ?, description = ? WHERE id = ?').run(
      name.trim(),
      description ?? null,
      id
    )
  })

  ipcMain.handle('collections:delete', async (_e, id: number) => {
    db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  })

  ipcMain.handle('collections:addPhotos', async (_e, photoIds: number[], collectionId: number) => {
    // Guards against a drag from one model's grid onto another model's collection.
    const insert = db.prepare(`
      INSERT OR IGNORE INTO collection_photos (collection_id, photo_id)
      SELECT ?, ?
      WHERE (SELECT model_id FROM photos WHERE id = ?)
          = (SELECT model_id FROM collections WHERE id = ?)
    `)
    const tx = db.transaction(() => {
      for (const pid of photoIds) insert.run(collectionId, pid, pid, collectionId)
    })
    tx()
  })

  ipcMain.handle('collections:removePhotos', async (_e, photoIds: number[], collectionId: number) => {
    const del = db.prepare(
      'DELETE FROM collection_photos WHERE collection_id = ? AND photo_id = ?'
    )
    const tx = db.transaction(() => {
      for (const pid of photoIds) del.run(collectionId, pid)
    })
    tx()
  })
}
