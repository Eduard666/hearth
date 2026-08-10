import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import ModelList from './ModelList'
import TagsModal from '../Tags/TagsModal'
import styles from './Sidebar.module.css'

export default function Sidebar(): JSX.Element {
  const { state, dispatch, loadModels, openModel } = useApp()
  const [newModelName, setNewModelName] = useState('')
  const [creatingModel, setCreatingModel] = useState(false)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState(false)
  const [showTags, setShowTags] = useState(false)

  const visibleModels = useMemo(() => {
    const query = search.trim().toLowerCase()
    return state.models.filter((m) => {
      if (m.status === 'archived' && !showArchived) return false
      return query === '' || m.name.toLowerCase().includes(query)
    })
  }, [state.models, search, showArchived])

  const archivedCount = state.models.filter((m) => m.status === 'archived').length

  const createModel = async (): Promise<void> => {
    const name = newModelName.trim()
    if (!name) return
    const model = await window.api.createModel(name)
    setNewModelName('')
    setCreatingModel(false)
    await loadModels()
    openModel(model.id)
  }

  const saveWorkspaceName = async (name: string): Promise<void> => {
    const trimmed = name.trim() || 'My agency'
    dispatch({ type: 'SET_WORKSPACE_NAME', payload: trimmed })
    setEditingWorkspace(false)
    await window.api.updateSettings({ workspaceName: trimmed })
  }

  return (
    <aside className={styles.sidebar}>
      {/* Workspace identity */}
      <div className={styles.brand}>
        <HearthLogo />
        {editingWorkspace ? (
          <input
            autoFocus
            className={styles.workspaceInput}
            defaultValue={state.workspaceName}
            onBlur={(e) => saveWorkspaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveWorkspaceName(e.currentTarget.value)
              if (e.key === 'Escape') setEditingWorkspace(false)
            }}
          />
        ) : (
          <button
            className={styles.brandName}
            onClick={() => setEditingWorkspace(true)}
            title="Rename workspace"
          >
            {state.workspaceName}
          </button>
        )}
      </div>

      {/* Models are the only entry point into the app */}
      <div className={styles.listSection}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Models</span>
          <button
            className={styles.sectionAddBtn}
            onClick={() => setCreatingModel(true)}
            title="New model"
          >
            <PlusIcon />
          </button>
        </div>

        {state.models.length > 6 && (
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models"
          />
        )}

        {creatingModel && (
          <div className={styles.inlineCreate}>
            <input
              autoFocus
              className={styles.inlineInput}
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              onBlur={() => !newModelName.trim() && setCreatingModel(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createModel()
                if (e.key === 'Escape') {
                  setCreatingModel(false)
                  setNewModelName('')
                }
              }}
              placeholder="Model name"
            />
          </div>
        )}

        <div className={styles.modelScroll}>
          <ModelList
            models={visibleModels}
            activeId={state.activeModelId ?? undefined}
            onSelect={openModel}
            onRefresh={loadModels}
          />
        </div>

        {archivedCount > 0 && (
          <button
            className={styles.archiveToggle}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.footerItem} onClick={() => setShowTags(true)}>
          <TagIcon />
          <span>Tags</span>
          {state.tags.length > 0 && <span className={styles.footerCount}>{state.tags.length}</span>}
        </button>
        <button className={styles.footerItem} onClick={() => window.api.rebuildThumbnails()}>
          <RefreshIcon />
          <span>Rebuild previews</span>
        </button>
      </div>

      {showTags && <TagsModal onClose={() => setShowTags(false)} />}
    </aside>
  )
}

function HearthLogo(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.brandIcon}>
      <path
        d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
        fill="var(--accent)"
      />
    </svg>
  )
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TagIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
