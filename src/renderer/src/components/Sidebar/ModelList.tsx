import { useState } from 'react'
import type { Model } from '../../../../shared/types'
import styles from './Sidebar.module.css'

interface ModelListProps {
  models: Model[]
  activeId?: number
  onSelect: (id: number) => void
  onRefresh: () => void
}

export default function ModelList({
  models,
  activeId,
  onSelect,
  onRefresh
}: ModelListProps): JSX.Element {
  const [renaming, setRenaming] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (m: Model): void => {
    setRenaming(m.id)
    setRenameValue(m.name)
  }

  const commitRename = async (id: number): Promise<void> => {
    if (renameValue.trim()) {
      await window.api.updateModel(id, renameValue.trim())
      onRefresh()
    }
    setRenaming(null)
  }

  if (models.length === 0) {
    return <div className={styles.emptyHint}>No models yet</div>
  }

  return (
    <>
      {models.map((m) => (
        <div
          key={m.id}
          className={`${styles.treeItem} ${activeId === m.id ? styles.active : ''}`}
          onClick={() => onSelect(m.id)}
          onDoubleClick={() => startRename(m)}
        >
          <PersonIcon />
          {renaming === m.id ? (
            <input
              autoFocus
              className={styles.inlineRename}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(m.id)
                if (e.key === 'Escape') setRenaming(null)
              }}
            />
          ) : (
            <>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </span>
              <span className={styles.count}>{m.photoCount}</span>
            </>
          )}
        </div>
      ))}
    </>
  )
}

function PersonIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
