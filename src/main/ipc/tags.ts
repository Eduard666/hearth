import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { Tag } from '../../shared/types'

interface RawTagRow {
  id: number
  name: string
  color: string
  created_at: string
  usage_count: number
}

function rowToTag(row: RawTagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    usageCount: row.usage_count
  }
}

const SELECT_TAG = `
  SELECT t.*, (SELECT COUNT(*) FROM photo_posts pp WHERE pp.tag_id = t.id) AS usage_count
  FROM tags t
`

/** Cycled through when the user does not pick a colour, so tags stay distinguishable. */
const TAG_COLORS = [
  '#ff4500',
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6'
]

export function registerTagHandlers(): void {
  const db = getDb()

  ipcMain.handle('tags:get', async () => {
    const rows = db
      .prepare(`${SELECT_TAG} ORDER BY t.name COLLATE NOCASE`)
      .all() as RawTagRow[]
    return rows.map(rowToTag)
  })

  ipcMain.handle('tags:create', async (_e, name: string, color?: string) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Tag name cannot be empty')

    const existing = db
      .prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE')
      .get(trimmed) as { id: number } | undefined
    if (existing) {
      // Re-use rather than fail: the user is trying to reach a tag that already exists.
      return rowToTag(db.prepare(`${SELECT_TAG} WHERE t.id = ?`).get(existing.id) as RawTagRow)
    }

    const count = (db.prepare('SELECT COUNT(*) AS c FROM tags').get() as { c: number }).c
    const result = db
      .prepare('INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)')
      .run(trimmed, color ?? TAG_COLORS[count % TAG_COLORS.length], new Date().toISOString())

    return rowToTag(
      db.prepare(`${SELECT_TAG} WHERE t.id = ?`).get(result.lastInsertRowid) as RawTagRow
    )
  })

  ipcMain.handle('tags:update', async (_e, id: number, name: string, color?: string) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Tag name cannot be empty')

    if (color) {
      db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(trimmed, color, id)
    } else {
      db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(trimmed, id)
    }
  })

  ipcMain.handle('tags:delete', async (_e, id: number) => {
    // photo_posts cascade, so deleting a tag also forgets that photos went there.
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  })

  ipcMain.handle('posts:mark', async (_e, photoIds: number[], tagId: number) => {
    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId)
    if (!tag) throw new Error(`Tag ${tagId} does not exist`)

    // The date is recorded automatically - that is the whole point of marking a post.
    const postedAt = new Date().toISOString()
    const insert = db.prepare(`
      INSERT INTO photo_posts (photo_id, tag_id, posted_at) VALUES (?, ?, ?)
      ON CONFLICT(photo_id, tag_id) DO UPDATE SET posted_at = excluded.posted_at
    `)

    db.transaction(() => {
      for (const photoId of photoIds) insert.run(photoId, tagId, postedAt)
    })()
  })

  ipcMain.handle('posts:unmark', async (_e, photoIds: number[], tagId: number) => {
    const del = db.prepare('DELETE FROM photo_posts WHERE photo_id = ? AND tag_id = ?')
    db.transaction(() => {
      for (const photoId of photoIds) del.run(photoId, tagId)
    })()
  })
}
