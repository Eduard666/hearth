import { useState } from 'react'
import type { Model } from '../../../../shared/types'
import { avatarColor } from '../../lib/avatar'
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
  const [menuFor, setMenuFor] = useState<number | null>(null)

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

  const toggleArchive = async (m: Model): Promise<void> => {
    await window.api.setModelStatus(m.id, m.status === 'archived' ? 'active' : 'archived')
    setMenuFor(null)
    onRefresh()
  }

  const remove = async (m: Model): Promise<void> => {
    const ok = window.confirm(
      `Delete ${m.name} and all ${m.photoCount} of their photos from Hearth?\n\nArchiving keeps the data and just hides the model.`
    )
    if (!ok) return
    await window.api.deleteModel(m.id)
    setMenuFor(null)
    onRefresh()
  }

  if (models.length === 0) {
    return <div className={styles.emptyHint}>No models yet</div>
  }

  return (
    <>
      {models.map((m) => (
        <div
          key={m.id}
          className={`${styles.modelItem} ${activeId === m.id ? styles.modelItemActive : ''} ${
            m.status === 'archived' ? styles.modelArchived : ''
          }`}
          onClick={() => onSelect(m.id)}
          onDoubleClick={() => startRename(m)}
        >
          <span className={styles.avatar} style={{ background: avatarColor(m.id) }}>
            {m.name.charAt(0).toUpperCase()}
          </span>

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
            <span className={styles.modelText}>
              <span className={styles.modelTopLine}>
                <span className={styles.itemName}>{m.name}</span>
                {m.status === 'archived' && <span className={styles.statusBadge}>Archived</span>}
              </span>
              <span className={styles.modelMeta}>
                {m.photoCount} photo{m.photoCount !== 1 ? 's' : ''}
                {m.lastOpenedAt && ` · ${formatRelative(m.lastOpenedAt)}`}
              </span>
            </span>
          )}

          <button
            className={styles.modelMenuBtn}
            onClick={(e) => {
              e.stopPropagation()
              setMenuFor(menuFor === m.id ? null : m.id)
            }}
            title="Model options"
          >
            <DotsIcon />
          </button>

          {menuFor === m.id && (
            <>
              <div className={styles.menuBackdrop} onClick={(e) => { e.stopPropagation(); setMenuFor(null) }} />
              <div className={styles.modelMenu} onClick={(e) => e.stopPropagation()}>
                <button className={styles.modelMenuItem} onClick={() => { setMenuFor(null); startRename(m) }}>
                  Rename
                </button>
                <button className={styles.modelMenuItem} onClick={() => toggleArchive(m)}>
                  {m.status === 'archived' ? 'Restore' : 'Archive'}
                </button>
                <button
                  className={`${styles.modelMenuItem} ${styles.modelMenuDanger}`}
                  onClick={() => remove(m)}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  )
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function DotsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}
