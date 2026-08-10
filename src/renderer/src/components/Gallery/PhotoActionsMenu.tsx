import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Photo } from '../../../../shared/types'
import styles from './CardMenu.module.css'

interface PhotoActionsMenuProps {
  photos: Photo[]
  onDone: () => void
  onClose: () => void
}

/** The 3-dot menu on a card: move photos into one of this model's collections. */
export default function PhotoActionsMenu({
  photos,
  onDone,
  onClose
}: PhotoActionsMenuProps): JSX.Element {
  const { state, activeModel, loadCollections } = useApp()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const photoIds = photos.map((p) => p.id)
  const fromCollectionId = state.activeCollectionId

  const moveTo = async (collectionId: number): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await window.api.addPhotosToCollection(photoIds, collectionId)
      // Viewing a collection makes this a move rather than a copy.
      if (fromCollectionId != null && fromCollectionId !== collectionId) {
        await window.api.removePhotosFromCollection(photoIds, fromCollectionId)
      }
      await loadCollections()
      onDone()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const createAndMove = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || !activeModel || busy) return
    setBusy(true)
    try {
      const collection = await window.api.createCollection(activeModel.id, trimmed)
      await window.api.addPhotosToCollection(photoIds, collection.id)
      if (fromCollectionId != null) {
        await window.api.removePhotosFromCollection(photoIds, fromCollectionId)
      }
      setName('')
      setCreating(false)
      await loadCollections()
      onDone()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const targets = state.collections.filter((c) => c.id !== fromCollectionId)

  return (
    <>
      <div className={styles.header}>
        {photos.length > 1 ? `Move ${photos.length} photos to` : 'Move to collection'}
      </div>

      {targets.length === 0 && !creating ? (
        <div className={styles.empty}>
          {state.collections.length === 0
            ? 'No collections yet.'
            : 'No other collection to move to.'}
        </div>
      ) : (
        <div className={styles.list}>
          {targets.map((collection) => (
            <button
              key={collection.id}
              className={styles.item}
              onClick={() => moveTo(collection.id)}
              disabled={busy}
            >
              <span className={styles.check} />
              <span className={styles.itemName}>{collection.name}</span>
              <span className={styles.itemDate}>{collection.photoCount}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.divider} />

      {creating || state.collections.length === 0 ? (
        <div className={styles.createRow}>
          <input
            autoFocus
            className={styles.createInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAndMove()
              if (e.key === 'Escape') {
                setCreating(false)
                setName('')
              }
            }}
            placeholder="New collection name"
          />
          <button className={styles.createBtn} onClick={createAndMove} disabled={!name.trim() || busy}>
            Create
          </button>
        </div>
      ) : (
        <button className={styles.item} onClick={() => setCreating(true)}>
          <span className={styles.check}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className={styles.itemName}>New collection…</span>
        </button>
      )}
    </>
  )
}
