import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc/index'
import { registerMediaProtocol, registerMediaScheme } from './media'
import { backfillThumbnails } from './thumbnails'
import { initUpdater, registerUpdaterHandlers } from './updater'

let mainWindow: BrowserWindow | null = null

const TITLE_BAR_COLORS = {
  dark: { color: '#111111', symbolColor: '#ffffff' },
  light: { color: '#f9f9f9', symbolColor: '#000000' }
} as const

function currentOverlayTheme(): 'dark' | 'light' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function applyTitleBarTheme(theme: 'dark' | 'light'): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setTitleBarOverlay({ ...TITLE_BAR_COLORS[theme], height: 40 })
}

registerMediaScheme()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      ...TITLE_BAR_COLORS[currentOverlayTheme()],
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Only relevant while the app follows the OS; an explicit in-app choice overrides it
// through the `window:setTitleBarTheme` channel below.
nativeTheme.on('updated', () => {
  applyTitleBarTheme(currentOverlayTheme())
  mainWindow?.webContents.send('theme-changed', currentOverlayTheme())
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.Eduard666.hearth')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  registerMediaProtocol()
  registerIpcHandlers()
  registerUpdaterHandlers()

  // The renderer owns the theme (it persists the user's choice in settings), so it tells
  // the main process which colors the native window buttons should use.
  ipcMain.on('window:setTitleBarTheme', (_e, theme: 'light' | 'dark') => {
    applyTitleBarTheme(theme === 'dark' ? 'dark' : 'light')
  })

  createWindow()
  initUpdater(mainWindow!)

  // Derived assets are generated lazily in the background so the gallery paints immediately.
  mainWindow?.webContents.once('did-finish-load', () => {
    void backfillThumbnails()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
