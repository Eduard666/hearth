import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { AppSettings } from '../../shared/types'

export function registerSettingsHandlers(): void {
  const db = getDb()

  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    const rows = db
      .prepare('SELECT key, value FROM app_settings')
      .all() as { key: string; value: string }[]
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      importMode: (map.importMode as 'copy' | 'reference') ?? 'copy',
      autoConvertHeic: map.autoConvertHeic === 'true',
      heicOutputFormat: (map.heicOutputFormat as 'jpeg' | 'png') ?? 'jpeg',
      theme: (map.theme as 'light' | 'dark' | 'system') ?? 'system',
      nearDuplicateThreshold: parseInt(map.nearDuplicateThreshold ?? '10', 10)
    }
  })

  ipcMain.handle('settings:update', async (_e, settings: Partial<AppSettings>): Promise<AppSettings> => {
    const upsert = db.prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(settings)) {
        upsert.run(k, String(v))
      }
    })
    tx()
    const rows = db
      .prepare('SELECT key, value FROM app_settings')
      .all() as { key: string; value: string }[]
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      importMode: (map.importMode as 'copy' | 'reference') ?? 'copy',
      autoConvertHeic: map.autoConvertHeic === 'true',
      heicOutputFormat: (map.heicOutputFormat as 'jpeg' | 'png') ?? 'jpeg',
      theme: (map.theme as 'light' | 'dark' | 'system') ?? 'system',
      nearDuplicateThreshold: parseInt(map.nearDuplicateThreshold ?? '10', 10)
    }
  })
}
