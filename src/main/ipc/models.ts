import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { Model, ModelStatus } from '../../shared/types'

interface RawModelRow {
  id: number
  name: string
  description: string | null
  created_at: string
  last_opened_at: string | null
  status: string
  photo_count: number
}

function rowToModel(row: RawModelRow): Model {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
    status: (row.status === 'archived' ? 'archived' : 'active') as ModelStatus,
    photoCount: row.photo_count
  }
}

const SELECT_MODEL = `
  SELECT m.*, (SELECT COUNT(*) FROM photos p WHERE p.model_id = m.id) AS photo_count
  FROM models m
`

export function registerModelHandlers(): void {
  const db = getDb()

  ipcMain.handle('models:get', async () => {
    const rows = db
      .prepare(`${SELECT_MODEL} ORDER BY m.status = 'archived', m.name COLLATE NOCASE`)
      .all() as RawModelRow[]
    return rows.map(rowToModel)
  })

  ipcMain.handle('models:create', async (_e, name: string, description?: string) => {
    const now = new Date().toISOString()
    const result = db
      .prepare(
        'INSERT INTO models (name, description, created_at, last_opened_at) VALUES (?, ?, ?, ?)'
      )
      .run(name.trim(), description ?? null, now, now)

    const row = db
      .prepare(`${SELECT_MODEL} WHERE m.id = ?`)
      .get(result.lastInsertRowid) as RawModelRow
    return rowToModel(row)
  })

  ipcMain.handle('models:update', async (_e, id: number, name: string, description?: string) => {
    db.prepare('UPDATE models SET name = ?, description = ? WHERE id = ?').run(
      name.trim(),
      description ?? null,
      id
    )
  })

  ipcMain.handle('models:setStatus', async (_e, id: number, status: ModelStatus) => {
    db.prepare('UPDATE models SET status = ? WHERE id = ?').run(
      status === 'archived' ? 'archived' : 'active',
      id
    )
  })

  // Drives "reopen the model you were last working in" on launch.
  ipcMain.handle('models:touch', async (_e, id: number) => {
    db.prepare('UPDATE models SET last_opened_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      id
    )
  })

  ipcMain.handle('models:delete', async (_e, id: number) => {
    // Photos and collections cascade; notes only null out their model_id, so clear them
    // explicitly rather than leaving notes no screen can reach.
    db.transaction(() => {
      db.prepare('DELETE FROM notes WHERE model_id = ?').run(id)
      db.prepare('DELETE FROM models WHERE id = ?').run(id)
    })()
  })

  ipcMain.handle('models:movePhotos', async (_e, photoIds: number[], modelId: number) => {
    const model = db.prepare('SELECT id FROM models WHERE id = ?').get(modelId)
    if (!model) throw new Error(`Model ${modelId} does not exist`)

    const move = db.prepare('UPDATE photos SET model_id = ? WHERE id = ?')
    // A photo leaving a model must also leave that model's collections.
    const detach = db.prepare(`
      DELETE FROM collection_photos
      WHERE photo_id = ?
        AND collection_id IN (SELECT id FROM collections WHERE model_id != ?)
    `)

    db.transaction(() => {
      for (const photoId of photoIds) {
        move.run(modelId, photoId)
        detach.run(photoId, modelId)
      }
    })()
  })
}
