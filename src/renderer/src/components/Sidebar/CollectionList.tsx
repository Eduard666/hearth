import { useState } from 'react'
import type { Collection } from '../../../../shared/types'
import styles from './Sidebar.module.css'

interface CollectionListProps {
  collections: Collection[]
  activeId?: number
  onSelect: (id: number) => void
  onRefresh: () => void
}

export default function CollectionList({
  collections,
  activeId,
  onSelect,
  onRefresh
}: CollectionListProps): JSX.Element {
  const [renaming, setRenaming] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (c: Collection): void => {
    setRenaming(c.id)
    setRenameValue(c.name)
  }

  const commitRename = async (id: number): Promise<void> => {
    if (renameValue.trim()) {
      await window.api.updateCollection(id, renameValue.trim())
      onRefresh()
    }
    setRenaming(null)
  }

  const handleDelete = async (id: number): Promise<void> => {
    await window.api.deleteCollection(id)
    onRefresh()
  }

  if (collections.length === 0) {
    return <div className={styles.emptyHint}>No collections yet</div>
  }

  return (
    <>
      {collections.map((c) => (
        <div
          key={c.id}
          className={`${styles.treeItem} ${activeId === c.id ? styles.active : ''}`}
          onClick={() => onSelect(c.id)}
          onDoubleClick={() => startRename(c)}
        >
          <CollectionIcon />
          {renaming === c.id ? (
            <input
              autoFocus
              className={styles.inlineRename}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(c.id)
                if (e.key === 'Escape') setRenaming(null)
              }}
            />
          ) : (
            <>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              <span className={styles.count}>{c.photoCount}</span>
            </>
          )}
        </div>
      ))}
    </>
  )
}

function CollectionIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
