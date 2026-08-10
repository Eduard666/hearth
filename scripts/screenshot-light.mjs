import { _electron as electron } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '..')
const electronExe = path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe')
const outDir = path.join(appDir, 'out', 'main', 'index.js')

const app = await electron.launch({
  executablePath: electronExe,
  args: [outDir],
  env: { ...process.env, NODE_ENV: 'production' },
  timeout: 30000,
})

await new Promise(r => setTimeout(r, 5000))
const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await new Promise(r => setTimeout(r, 2000))

// Force light mode via the HTML attribute
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
})
await new Promise(r => setTimeout(r, 500))

await page.screenshot({ path: path.join(appDir, 'scripts', 'hearth-light.png') })
console.log('Light mode screenshot saved')

// Also expand the Library section
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const lib = btns.find(b => b.textContent?.trim().includes('Library') || b.textContent?.trim().includes('LIBRARY'))
  lib?.click()
})
await new Promise(r => setTimeout(r, 300))
await page.screenshot({ path: path.join(appDir, 'scripts', 'hearth-light-expanded.png') })
console.log('Light mode expanded screenshot saved')

await app.close()
process.exit(0)
