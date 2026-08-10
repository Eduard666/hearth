import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [systemPrefers, setSystemPrefers] = useState<ResolvedTheme>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )

  const resolved: ResolvedTheme = mode === 'system' ? systemPrefers : mode

  useEffect(() => {
    window.api.getSettings().then((s) => setModeState(s.theme))
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent): void =>
      setSystemPrefers(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)

    // The native minimize/maximize/close buttons are painted by the OS, not the page, so
    // the main process has to repaint the overlay on every theme change. The colours are
    // read back from the stylesheet rather than duplicated here, so the buttons cannot
    // drift out of sync with the title bar they sit in.
    const computed = getComputedStyle(document.documentElement)
    const read = (token: string, fallback: string): string =>
      computed.getPropertyValue(token).trim() || fallback

    window.api.setTitleBarTheme({
      // Must match .titlebar's background in AppLayout.module.css.
      color: read('--sidebar-bg', resolved === 'dark' ? '#161616' : '#f0f0f0'),
      symbolColor: read('--text-primary', resolved === 'dark' ? '#f0f0f0' : '#111111')
    })
  }, [resolved])

  const setMode = (next: ThemeMode): void => {
    setModeState(next)
    window.api.updateSettings({ theme: next })
  }

  const toggle = (): void => {
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
