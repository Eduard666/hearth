import { useTheme } from '../../context/ThemeContext'
import { useApp } from '../../context/AppContext'
import Sidebar from '../Sidebar/Sidebar'
import ModelSpace from '../ModelSpace/ModelSpace'
import Onboarding from '../Onboarding/Onboarding'
import UpdateNotification from '../UpdateNotification/UpdateNotification'
import VersionBadge from '../UpdateNotification/VersionBadge'
import styles from './AppLayout.module.css'

export default function AppLayout(): JSX.Element {
  const { resolved, toggle } = useTheme()
  const { state, dispatch, activeModel } = useApp()

  // No model open means there is nothing to work on - the funnel starts at a model.
  const showOnboarding = state.ready && !activeModel

  const update = state.update
  const updateReady = update?.status === 'downloaded'
  const dismissed =
    update?.availableVersion != null && update.availableVersion === state.dismissedUpdateVersion

  return (
    <div className={styles.root} data-theme={resolved}>
      <div className={styles.titlebar}>
        <VersionBadge />
        <div className={styles.titlebarDrag} />
        <div className={styles.titlebarActions}>
          <button className={styles.themeToggle} onClick={toggle} title="Toggle theme">
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {state.models.length > 0 && <Sidebar />}
        <main className={styles.main}>
          {showOnboarding ? <Onboarding /> : <ModelSpace />}
        </main>
      </div>

      {update && !dismissed && (update.status === 'downloading' || updateReady) && (
        <UpdateNotification
          update={update}
          onDismiss={() => dispatch({ type: 'DISMISS_UPDATE' })}
          onInstall={() => window.api.installUpdate()}
        />
      )}
    </div>
  )
}

function SunIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
