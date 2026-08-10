import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import styles from './VersionBadge.module.css'

/**
 * Version readout in the title bar. Doubles as the manual "check for updates" control and
 * shows a dot when a newer version is waiting, so the app is never silently out of date.
 */
export default function VersionBadge(): JSX.Element | null {
  const { state, dispatch } = useApp()
  const [checking, setChecking] = useState(false)
  const update = state.update

  if (!update) return null

  const downloading = update.status === 'downloading' && update.availableVersion != null
  const ready = update.status === 'downloaded' && update.availableVersion != null
  const outdated = downloading || ready

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      const next = await window.api.checkForUpdates()
      dispatch({ type: 'SET_UPDATE', payload: next })
    } finally {
      setChecking(false)
    }
  }

  return (
    <button
      className={`${styles.badge} ${outdated ? styles.badgeOutdated : ''}`}
      onClick={check}
      disabled={checking || update.status === 'checking'}
      title={title(update.status, checking, update.availableVersion, update.error)}
    >
      {outdated && <span className={styles.dot} />}
      <span className={styles.label}>Version {update.currentVersion}</span>
      {checking || update.status === 'checking' ? (
        <span className={styles.hint}>checking…</span>
      ) : downloading ? (
        <span className={styles.hint}>
          downloading{update.percent != null ? ` ${update.percent}%` : '…'}
        </span>
      ) : ready ? (
        <span className={styles.hint}>update ready</span>
      ) : null}
    </button>
  )
}

function title(
  status: string,
  checking: boolean,
  availableVersion?: string,
  error?: string
): string {
  if (checking || status === 'checking') return 'Checking for updates…'
  if (status === 'downloading') return `Downloading version ${availableVersion}…`
  if (status === 'downloaded') return `Version ${availableVersion} is ready to install`
  if (status === 'up-to-date') return 'Up to date - click to check again'
  if (status === 'error') return `Update check failed: ${error ?? 'unknown error'}`
  return 'Click to check for updates'
}
