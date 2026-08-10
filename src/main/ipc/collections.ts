import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerCollectionHandlers(): void {
  const db = getDb()

  ipcMain.handle('collections:get', async () => {
    const rows = db.prepare(`
      SELECT c.*, COUNT(cp.photo_id) as photo_count
      FROM collections c
      LEFT JOIN collection_photos cp ON cp.collection_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `).all() as { id: number; name: string; description: string | null; created_at: string; photo_count: number }[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at,
      photoCount: r.photo_count
    }))
  })

  ipcMain.handle('collections:create', async (_e, name: string, description?: string) => {
    const now = new Date().toISOString()
    const result = db
      .prepare('INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)')
      .run(name.trim(), description ?? null, now)
    const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(result.lastInsertRowid) as {
      id: number; name: string; description: string | null; created_at: string
    }
    return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at, photoCount: 0 }
  })

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
    const insert = db.prepare(
      'INSERT OR IGNORE INTO collection_photos (collection_id, photo_id) VALUES (?, ?)'
    )
    const tx = db.transaction(() => {
      for (const pid of photoIds) insert.run(collectionId, pid)
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
