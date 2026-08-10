import { ipcMain, dialog } from 'electron'

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

}
