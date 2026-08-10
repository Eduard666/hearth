import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'

export function initUpdater(win: BrowserWindow): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Update check failed:', err.message)
  })
}
