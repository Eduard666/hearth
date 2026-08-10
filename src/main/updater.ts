import { autoUpdater } from 'electron-updater'
import { BrowserWindow, app, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { UpdateState } from '../shared/types'

/** Long-running windows would otherwise never notice a release published after launch. */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let state: UpdateState = { status: 'idle', currentVersion: app.getVersion() }
let timer: ReturnType<typeof setInterval> | null = null

function setState(next: Partial<UpdateState>): void {
  state = { ...state, ...next }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:state', state)
  }
}

/** Registered even in dev so the title bar can always show a version. */
export function registerUpdaterHandlers(): void {
  ipcMain.handle('update:getState', () => state)

  ipcMain.handle('update:check', async () => {
    if (is.dev) {
      // There is no packaged app to replace, so a real check would only ever error.
      setState({ status: 'idle', error: 'Updates are disabled in development' })
      return state
    }
    await runCheck()
    return state
  })

  ipcMain.on('install-update', () => {
    if (state.status === 'downloaded') autoUpdater.quitAndInstall()
  })
}

export function initUpdater(_win: BrowserWindow): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: undefined }))

  autoUpdater.on('update-available', (info) => {
    setState({
      status: 'downloading',
      availableVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
      error: undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    setState({ status: 'up-to-date', availableVersion: undefined, error: undefined })
  })

  autoUpdater.on('download-progress', (progress) => {
    setState({ status: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setState({
      status: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
    })
  })

  autoUpdater.on('error', (err) => {
    // A repo with no published releases 404s here; that is not worth alarming the user
    // about, but it should not look like a successful check either.
    console.error('[updater]', err.message)
    setState({ status: 'error', error: err.message })
  })

  void runCheck()
  timer = setInterval(() => void runCheck(), RECHECK_INTERVAL_MS)

  app.on('before-quit', () => {
    if (timer) clearInterval(timer)
  })
}

async function runCheck(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[updater] check failed:', message)
    setState({ status: 'error', error: message })
  }
}
