import { _electron as electron } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '..')

const electronExe = path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe')
const outDir = path.join(appDir, 'out', 'main', 'index.js')

console.log('Launching Hearth...')

const app = await electron.launch({
  executablePath: electronExe,
  args: [outDir],
  env: { ...process.env, NODE_ENV: 'production' },
  timeout: 30000,
})

// Wait for the window to load
await new Promise(r => setTimeout(r, 5000))

const windows = app.windows()
console.log('Windows:', windows.length)
for (const w of windows) console.log(' -', w.url())

const page = windows.find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()

await page.waitForLoadState('domcontentloaded')
await new Promise(r => setTimeout(r, 2000))

const shotPath = path.join(appDir, 'scripts', 'hearth-screenshot.png')
await page.screenshot({ path: shotPath, fullPage: false })
console.log('Screenshot saved to:', shotPath)

await app.close()
process.exit(0)
