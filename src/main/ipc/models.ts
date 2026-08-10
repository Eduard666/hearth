import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerModelHandlers(): void {
  const db = getDb()

  ipcMain.handle('models:get', async () => {
    const rows = db.prepare(`
      SELECT m.*, COUNT(mp.photo_id) as photo_count
      FROM models m
      LEFT JOIN model_photos mp ON mp.model_id = m.id
      GROUP BY m.id
      ORDER BY m.name
    `).all() as { id: number; name: string; description: string | null; created_at: string; photo_count: number }[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at,
      photoCount: r.photo_count
    }))
  })

  ipcMain.handle('models:create', async (_e, name: string, description?: string) => {
    const now = new Date().toISOString()
    const result = db
      .prepare('INSERT INTO models (name, description, created_at) VALUES (?, ?, ?)')
      .run(name.trim(), description ?? null, now)
    const row = db.prepare('SELECT * FROM models WHERE id = ?').get(result.lastInsertRowid) as {
      id: number; name: string; description: string | null; created_at: string
    }
    return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at, photoCount: 0 }
  })

  ipcMain.handle('models:update', async (_e, id: number, name: string, description?: string) => {
    db.prepare('UPDATE models SET name = ?, description = ? WHERE id = ?').run(
      name.trim(),
      description ?? null,
      id
    )
  })

  ipcMain.handle('models:delete', async (_e, id: number) => {
    db.prepare('DELETE FROM models WHERE id = ?').run(id)
  })

  ipcMain.handle('models:addPhotos', async (_e, photoIds: number[], modelId: number) => {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO model_photos (model_id, photo_id) VALUES (?, ?)'
    )
    const tx = db.transaction(() => {
      for (const pid of photoIds) insert.run(modelId, pid)
    })
    tx()
  })

  ipcMain.handle('models:removePhotos', async (_e, photoIds: number[], modelId: number) => {
    const del = db.prepare('DELETE FROM model_photos WHERE model_id = ? AND photo_id = ?')
    const tx = db.transaction(() => {
      for (const pid of photoIds) del.run(modelId, pid)
    })
    tx()
  })
}
