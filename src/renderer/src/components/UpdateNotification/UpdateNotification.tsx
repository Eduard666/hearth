import { useState } from 'react'
import type { UpdateInfo } from '../../../../shared/types'
import styles from './UpdateNotification.module.css'

interface UpdateNotificationProps {
  info: UpdateInfo
  downloaded: boolean
  onDismiss: () => void
  onInstall: () => void
}

export default function UpdateNotification({
  info,
  downloaded,
  onDismiss,
  onInstall
}: UpdateNotificationProps): JSX.Element {
  return (
    <div className={styles.notification} role="status">
      <div className={styles.icon}>
        <HearthIcon />
      </div>
      <div className={styles.body}>
        {downloaded ? (
          <button className={styles.installBtn} onClick={onInstall}>
            Relaunch to update
          </button>
        ) : (
          <span className={styles.label}>Downloading update</span>
        )}
        <span className={styles.version}>v{info.version}</span>
      </div>
      <button className={styles.dismiss} onClick={onDismiss} title="Dismiss">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function HearthIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
