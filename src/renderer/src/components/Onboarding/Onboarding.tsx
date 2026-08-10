import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { avatarColor } from '../../lib/avatar'
import styles from './Onboarding.module.css'

/**
 * Shown when no model is open. With an empty workspace it is the "create your first
 * model" screen; once models exist it is the roster you pick from.
 */
export default function Onboarding(): JSX.Element {
  const { state, loadModels, openModel } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const hasModels = state.models.length > 0

  const create = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      const model = await window.api.createModel(trimmed)
      setName('')
      await loadModels()
      openModel(model.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <h1 className={styles.title}>
          {hasModels ? 'Choose a model to work on' : 'Create your first model'}
        </h1>
        <p className={styles.subtitle}>
          {hasModels
            ? 'Everything in Hearth lives inside a model - photos, collections and notes.'
            : 'Hearth organises everything by model. Add one, then import their photos into it.'}
        </p>

        <div className={styles.createRow}>
          <input
            autoFocus
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Model name"
          />
          <button className={styles.createBtn} onClick={create} disabled={!name.trim() || busy}>
            Create model
          </button>
        </div>

        {hasModels && (
          <div className={styles.roster}>
            {state.models.map((model) => (
              <button
                key={model.id}
                className={styles.rosterItem}
                onClick={() => openModel(model.id)}
              >
                <span className={styles.avatar} style={{ background: avatarColor(model.id) }}>
                  {model.name.charAt(0).toUpperCase()}
                </span>
                <span className={styles.rosterText}>
                  <span className={styles.rosterName}>{model.name}</span>
                  <span className={styles.rosterMeta}>
                    {model.photoCount} photo{model.photoCount !== 1 ? 's' : ''}
                    {model.status === 'archived' && ' · archived'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
