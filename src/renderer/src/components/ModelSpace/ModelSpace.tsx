import { useState } from 'react'
import { useApp, type ModelTab } from '../../context/AppContext'
import { avatarColor } from '../../lib/avatar'
import Gallery from '../Gallery/Gallery'
import NotesEditor from '../Notes/NotesEditor'
import CollectionsPanel from './CollectionsPanel'
import styles from './ModelSpace.module.css'

export default function ModelSpace(): JSX.Element | null {
  const { state, dispatch, activeModel, loadPhotos, loadModels } = useApp()
  const [importing, setImporting] = useState(false)

  if (!activeModel) return null

  const activeCollection = state.collections.find((c) => c.id === state.activeCollectionId)

  // Import is only reachable from inside a model's space, and always targets that model.
  const runImport = async (pick: () => Promise<string[]>): Promise<void> => {
    setImporting(true)
    try {
      const paths = await pick()
      if (paths.length === 0) return
      await window.api.importPhotos(paths, activeModel.id)
      await Promise.all([loadPhotos(), loadModels()])
    } finally {
      setImporting(false)
    }
  }

  const importFiles = (): Promise<void> => runImport(() => window.api.pickFiles())
  const importFolder = (): Promise<void> =>
    runImport(async () => {
      const folder = await window.api.pickFolder()
      return folder ? [folder] : []
    })

  const tabs: { id: ModelTab; label: string; icon: JSX.Element }[] = [
    { id: 'photos', label: 'Photos', icon: <PhotosIcon /> },
    { id: 'collections', label: 'Collections', icon: <CollectionIcon /> },
    { id: 'notes', label: 'Notes', icon: <NotesIcon /> }
  ]

  return (
    <div className={styles.space}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatar} style={{ background: avatarColor(activeModel.id) }}>
            {activeModel.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.headerText}>
            <h1 className={styles.modelName}>{activeModel.name}</h1>
            <span className={styles.modelMeta}>
              {activeModel.photoCount} photo{activeModel.photoCount !== 1 ? 's' : ''}
              {activeCollection && ` · viewing ${activeCollection.name}`}
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.importPrimary} onClick={importFiles} disabled={importing}>
            <PlusIcon />
            {importing ? 'Importing…' : 'Import photos'}
          </button>
          <button className={styles.importSecondary} onClick={importFolder} disabled={importing}>
            <FolderIcon />
            Import folder
          </button>
        </div>
      </div>

      <nav className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${state.activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'collections' && state.collections.length > 0 && (
              <span className={styles.tabCount}>{state.collections.length}</span>
            )}
          </button>
        ))}

        {state.activeCollectionId != null && state.activeTab === 'photos' && (
          <button
            className={styles.clearFilter}
            onClick={() => dispatch({ type: 'SET_COLLECTION', payload: null })}
          >
            Show all photos
          </button>
        )}
      </nav>

      <div className={styles.content}>
        {state.activeTab === 'photos' && <Gallery onImport={importFiles} />}
        {state.activeTab === 'collections' && <CollectionsPanel />}
        {state.activeTab === 'notes' && (
          <NotesEditor target={{ kind: 'model', id: activeModel.id, name: activeModel.name }} />
        )}
      </div>
    </div>
  )
}

function PhotosIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function CollectionIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function NotesIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
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

function FolderIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}
