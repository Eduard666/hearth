import type { UpdateState } from '../../../../shared/types'
import styles from './UpdateNotification.module.css'

interface UpdateNotificationProps {
  update: UpdateState
  onDismiss: () => void
  onInstall: () => void
}

export default function UpdateNotification({
  update,
  onDismiss,
  onInstall
}: UpdateNotificationProps): JSX.Element {
  const ready = update.status === 'downloaded'

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <div className={styles.icon}>
        <HearthIcon />
      </div>

      <div className={styles.body}>
        <div className={styles.title}>{ready ? 'Update ready' : 'Downloading update'}</div>
        <div className={styles.detail}>
          {ready
            ? `Version ${update.availableVersion} · restart to finish installing`
            : `Version ${update.availableVersion}${
                update.percent != null ? ` · ${update.percent}%` : ''
              }`}
        </div>

        {!ready && (
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${update.percent ?? 0}%` }} />
          </div>
        )}

        {ready && (
          <div className={styles.actions}>
            <button className={styles.laterBtn} onClick={onDismiss}>
              Later
            </button>
            <button className={styles.installBtn} onClick={onInstall}>
              Restart now
            </button>
          </div>
        )}
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </svg>
  )
}
