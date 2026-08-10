import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { Note } from '../../shared/types'

interface RawNote {
  id: number
  title: string
  content: string
  collection_id: number | null
  model_id: number | null
  created_at: string
  updated_at: string
}

function rowToNote(row: RawNote): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    collectionId: row.collection_id,
    modelId: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function registerNoteHandlers(): void {
  const db = getDb()

  ipcMain.handle('notes:get', async (_e, filter?: { collectionId?: number; modelId?: number }) => {
    let sql = 'SELECT * FROM notes WHERE 1=1'
    const params: (number | null)[] = []

    if (filter?.collectionId != null) {
      sql += ' AND collection_id = ?'
      params.push(filter.collectionId)
    }
    if (filter?.modelId != null) {
      sql += ' AND model_id = ?'
      params.push(filter.modelId)
    }

    sql += ' ORDER BY updated_at DESC'
    const rows = db.prepare(sql).all(...params) as RawNote[]
    return rows.map(rowToNote)
  })

  ipcMain.handle('notes:getOne', async (_e, id: number) => {
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNote | undefined
    return row ? rowToNote(row) : null
  })

  ipcMain.handle('notes:create', async (_e, data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO notes (title, content, collection_id, model_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.title, data.content, data.collectionId ?? null, data.modelId ?? null, now, now)
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as RawNote
    return rowToNote(row)
  })

  ipcMain.handle('notes:update', async (_e, id: number, title: string, content: string) => {
    const now = new Date().toISOString()
    db.prepare('UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
      title,
      content,
      now,
      id
    )
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNote
    return rowToNote(row)
  })

  ipcMain.handle('notes:delete', async (_e, id: number) => {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  })
}
