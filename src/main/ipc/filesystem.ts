import { ipcMain, dialog, app } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { FileTreeNode } from '../../shared/types'

const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.heic', '.heif', '.hif'
])

export function registerFileSystemHandlers(): void {
  ipcMain.handle('fs:pickFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('fs:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:getFileTree', async (_e, rootPath?: string) => {
    const base = rootPath ?? app.getPath('userData')
    return buildFileTree(base, 0)
  })
}

function buildFileTree(dirPath: string, depth: number): FileTreeNode[] {
  if (depth > 5) return []
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    const nodes: FileTreeNode[] = []

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children: buildFileTree(fullPath, depth + 1),
          photoCount: countPhotos(fullPath)
        })
      } else if (IMAGE_EXTS.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          children: []
        })
      }
    }

    return nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
}

function countPhotos(dirPath: string): number {
  try {
    return readdirSync(dirPath).filter((f) =>
      IMAGE_EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase())
    ).length
  } catch {
    return 0
  }
}
