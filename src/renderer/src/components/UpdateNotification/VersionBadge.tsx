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

  // One control, two jobs: install the waiting update if there is one, otherwise go and
  // look for one. Clicking the version never leaves the user on a stale build.
  const activate = async (): Promise<void> => {
    if (ready) {
      window.api.installUpdate()
      return
    }
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
      onClick={activate}
      disabled={checking || update.status === 'checking' || downloading}
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
        <span className={styles.hint}>click to update</span>
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
  if (status === 'downloaded') return `Click to update to version ${availableVersion} and restart`
  if (status === 'up-to-date') return 'Up to date - click to check again'
  if (status === 'error') return `Update check failed: ${error ?? 'unknown error'}`
  return 'Click to check for updates'
}
