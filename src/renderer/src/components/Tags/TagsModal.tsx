import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Tag } from '../../../../shared/types'
import styles from './TagsModal.module.css'

const PALETTE = [
  '#ff4500',
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6'
]

interface TagsModalProps {
  onClose: () => void
}

/**
 * Manages the workspace's posting destinations. Tags are shared across models, so the
 * subreddit list is built once and reused for every model.
 */
export default function TagsModal({ onClose }: TagsModalProps): JSX.Element {
  const { state, loadTags, loadPhotos } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const create = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await window.api.createTag(trimmed)
      setName('')
      await loadTags()
    } finally {
      setBusy(false)
    }
  }

  const rename = async (tag: Tag): Promise<void> => {
    const trimmed = editValue.trim()
    setEditing(null)
    if (!trimmed || trimmed === tag.name) return
    await window.api.updateTag(tag.id, trimmed)
    await Promise.all([loadTags(), loadPhotos()])
  }

  const recolor = async (tag: Tag, color: string): Promise<void> => {
    await window.api.updateTag(tag.id, tag.name, color)
    await Promise.all([loadTags(), loadPhotos()])
  }

  const remove = async (tag: Tag): Promise<void> => {
    const ok = window.confirm(
      tag.usageCount > 0
        ? `Delete "${tag.name}"?\n\nThis also forgets that ${tag.usageCount} photo${
            tag.usageCount !== 1 ? 's were' : ' was'
          } posted there. The photos themselves stay.`
        : `Delete "${tag.name}"?`
    )
    if (!ok) return
    await window.api.deleteTag(tag.id)
    await Promise.all([loadTags(), loadPhotos()])
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Tags</h2>
            <p className={styles.subtitle}>
              Everywhere you post. Name them however you like - one per subreddit works well.
            </p>
          </div>
          <button className={styles.close} onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.createRow}>
          <input
            autoFocus
            className={styles.createInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="e.g. r/RealGirls"
          />
          <button className={styles.createBtn} onClick={create} disabled={!name.trim() || busy}>
            Add tag
          </button>
        </div>

        {state.tags.length === 0 ? (
          <div className={styles.empty}>
            No tags yet. Add one above, then right-click a photo to mark where it went.
          </div>
        ) : (
          <div className={styles.list}>
            {state.tags.map((tag) => (
              <div key={tag.id} className={styles.row}>
                <div className={styles.swatches}>
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      className={`${styles.swatch} ${tag.color.toLowerCase() === color ? styles.swatchOn : ''}`}
                      style={{ background: color }}
                      onClick={() => recolor(tag, color)}
                      title={`Use ${color}`}
                    />
                  ))}
                </div>

                {editing === tag.id ? (
                  <input
                    autoFocus
                    className={styles.renameInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => rename(tag)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(tag)
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <button
                    className={styles.rowName}
                    onClick={() => {
                      setEditing(tag.id)
                      setEditValue(tag.name)
                    }}
                    title="Click to rename"
                  >
                    {tag.name}
                  </button>
                )}

                <span className={styles.usage}>
                  {tag.usageCount} photo{tag.usageCount !== 1 ? 's' : ''}
                </span>

                <button className={styles.delete} onClick={() => remove(tag)} title="Delete tag">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
