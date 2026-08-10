import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc/index'
import { registerMediaProtocol, registerMediaScheme } from './media'
import { backfillThumbnails } from './thumbnails'
import { initUpdater, registerUpdaterHandlers } from './updater'
import type { TitleBarColors } from '../shared/types'

let mainWindow: BrowserWindow | null = null

const TITLE_BAR_HEIGHT = 40

/**
 * Starting colours only. They mirror --sidebar-bg / --text-primary in variables.css so the
 * buttons look right for the split second before the renderer reports its own theme, which
 * it then does on every change.
 */
const TITLE_BAR_COLORS = {
  dark: { color: '#161616', symbolColor: '#f0f0f0' },
  light: { color: '#f0f0f0', symbolColor: '#111111' }
} as const

/** Once the renderer reports a theme, the OS preference must stop overriding it. */
let rendererOwnsTitleBar = false

function currentOverlayTheme(): 'dark' | 'light' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

function applyTitleBarOverlay(colors: TitleBarColors): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // setTitleBarOverlay throws on a malformed colour, which would take the window with it.
  if (!HEX_COLOR.test(colors.color) || !HEX_COLOR.test(colors.symbolColor)) {
    console.error('[titlebar] ignoring invalid overlay colours:', colors)
    return
  }

  try {
    mainWindow.setTitleBarOverlay({ ...colors, height: TITLE_BAR_HEIGHT })
  } catch (err) {
    console.error('[titlebar] failed to apply overlay:', err)
  }
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

// Only a stopgap until the renderer reports in; after that the app's own theme wins,
// including when it is set to follow the OS.
nativeTheme.on('updated', () => {
  if (rendererOwnsTitleBar) return
  applyTitleBarOverlay(TITLE_BAR_COLORS[currentOverlayTheme()])
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

  // The renderer owns the theme (it persists the user's choice in settings) and reads the
  // colours straight off its own stylesheet, so the buttons always match the title bar.
  ipcMain.on('window:setTitleBarTheme', (_e, colors: TitleBarColors) => {
    rendererOwnsTitleBar = true
    applyTitleBarOverlay(colors)
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
