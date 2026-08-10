import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import type { FileTreeNode, Collection, Model } from '../../../../shared/types'
import CollectionList from './CollectionList'
import ModelList from './ModelList'
import FileTree from './FileTree'
import styles from './Sidebar.module.css'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

type SidebarSection = 'library' | 'collections' | 'models'

export default function Sidebar({ open, onToggle }: SidebarProps): JSX.Element {
  const { state, dispatch, loadPhotos, loadCollections, loadModels } = useApp()
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<SidebarSection>>(
    new Set(['library', 'collections', 'models'])
  )
  const [newCollectionName, setNewCollectionName] = useState('')
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const [creatingModel, setCreatingModel] = useState(false)

  useEffect(() => {
    window.api.getFileTree().then(setFileTree)
  }, [])

  const toggleSection = (section: SidebarSection): void => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const handleFolderSelect = (path: string): void => {
    dispatch({ type: 'SET_FILTER', payload: { ...state.activeFilter, folderPath: path, collectionId: undefined, modelId: undefined } })
  }

  const handleLibrarySelect = (): void => {
    dispatch({ type: 'SET_FILTER', payload: {} })
  }

  const handleCollectionSelect = (id: number): void => {
    dispatch({ type: 'SET_FILTER', payload: { collectionId: id, folderPath: undefined, modelId: undefined } })
    dispatch({ type: 'SET_VIEW', payload: 'gallery' })
  }

  const handleModelSelect = (id: number): void => {
    dispatch({ type: 'SET_FILTER', payload: { modelId: id, folderPath: undefined, collectionId: undefined } })
    dispatch({ type: 'SET_VIEW', payload: 'gallery' })
  }

  const createCollection = async (): Promise<void> => {
    if (!newCollectionName.trim()) return
    await window.api.createCollection(newCollectionName.trim())
    setNewCollectionName('')
    setCreatingCollection(false)
    loadCollections()
  }

  const createModel = async (): Promise<void> => {
    if (!newModelName.trim()) return
    await window.api.createModel(newModelName.trim())
    setNewModelName('')
    setCreatingModel(false)
    loadModels()
  }

  const handleImportFiles = async (): Promise<void> => {
    const paths = await window.api.pickFiles()
    if (paths.length === 0) return
    await window.api.importPhotos(paths)
    loadPhotos()
  }

  const handleImportFolder = async (): Promise<void> => {
    const folder = await window.api.pickFolder()
    if (!folder) return
    await window.api.importPhotos([folder])
    window.api.getFileTree().then(setFileTree)
    loadPhotos()
  }

  if (!open) {
    return (
      <aside className={styles.collapsed}>
        <button className={styles.toggleBtn} onClick={onToggle} title="Open sidebar">
          <ChevronRightIcon />
        </button>
      </aside>
    )
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.appName}>Hearth</span>
        <button className={styles.toggleBtn} onClick={onToggle} title="Close sidebar">
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Import actions */}
      <div className={styles.importActions}>
        <button className={styles.importBtn} onClick={handleImportFiles}>
          <PlusIcon /> Import files
        </button>
        <button className={styles.importBtnSecondary} onClick={handleImportFolder}>
          <FolderIcon /> Import folder
        </button>
      </div>

      <div className={styles.sections}>
        {/* Library section */}
        <div className={styles.section}>
          <button
            className={styles.sectionHeader}
            onClick={() => toggleSection('library')}
          >
            <ChevronIcon expanded={expandedSections.has('library')} />
            <span>Library</span>
          </button>
          {expandedSections.has('library') && (
            <div className={styles.sectionBody}>
              <button
                className={`${styles.treeItem} ${!state.activeFilter.collectionId && !state.activeFilter.folderPath && !state.activeFilter.modelId ? styles.active : ''}`}
                onClick={handleLibrarySelect}
              >
                <GridIcon />
                <span>All photos</span>
                <span className={styles.count}>{state.photos.length}</span>
              </button>
              <FileTree
                nodes={fileTree}
                onSelect={handleFolderSelect}
                activePath={state.activeFilter.folderPath}
              />
            </div>
          )}
        </div>

        {/* Collections section */}
        <div className={styles.section}>
          <button
            className={styles.sectionHeader}
            onClick={() => toggleSection('collections')}
          >
            <ChevronIcon expanded={expandedSections.has('collections')} />
            <span>Collections</span>
            <button
              className={styles.addBtn}
              onClick={(e) => { e.stopPropagation(); setCreatingCollection(true) }}
              title="New collection"
            >
              <PlusIcon />
            </button>
          </button>
          {expandedSections.has('collections') && (
            <div className={styles.sectionBody}>
              {creatingCollection && (
                <div className={styles.inlineCreate}>
                  <input
                    autoFocus
                    className={styles.inlineInput}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createCollection()
                      if (e.key === 'Escape') { setCreatingCollection(false); setNewCollectionName('') }
                    }}
                    placeholder="Collection name"
                  />
                </div>
              )}
              <CollectionList
                collections={state.collections}
                activeId={state.activeFilter.collectionId}
                onSelect={handleCollectionSelect}
                onRefresh={loadCollections}
              />
            </div>
          )}
        </div>

        {/* Models section */}
        <div className={styles.section}>
          <button
            className={styles.sectionHeader}
            onClick={() => toggleSection('models')}
          >
            <ChevronIcon expanded={expandedSections.has('models')} />
            <span>Models</span>
            <button
              className={styles.addBtn}
              onClick={(e) => { e.stopPropagation(); setCreatingModel(true) }}
              title="New model"
            >
              <PlusIcon />
            </button>
          </button>
          {expandedSections.has('models') && (
            <div className={styles.sectionBody}>
              {creatingModel && (
                <div className={styles.inlineCreate}>
                  <input
                    autoFocus
                    className={styles.inlineInput}
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createModel()
                      if (e.key === 'Escape') { setCreatingModel(false); setNewModelName('') }
                    }}
                    placeholder="Model name"
                  />
                </div>
              )}
              <ModelList
                models={state.models}
                activeId={state.activeFilter.modelId}
                onSelect={handleModelSelect}
                onRefresh={loadModels}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease', flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ChevronRightIcon(): JSX.Element {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
}

function ChevronLeftIcon(): JSX.Element {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
}

function PlusIcon(): JSX.Element {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}

function FolderIcon(): JSX.Element {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
}

function GridIcon(): JSX.Element {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
}
