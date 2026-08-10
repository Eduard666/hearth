import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Collection } from '../../../../shared/types'
import styles from './CollectionsPanel.module.css'

export default function CollectionsPanel(): JSX.Element {
  const { state, dispatch, activeModel, loadCollections } = useApp()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const create = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || !activeModel) return
    await window.api.createCollection(activeModel.id, trimmed)
    setName('')
    setCreating(false)
    loadCollections()
  }

  const remove = async (collection: Collection): Promise<void> => {
    const ok = window.confirm(
      `Delete the collection "${collection.name}"?\n\nThe photos themselves stay in ${activeModel?.name ?? 'this model'}.`
    )
    if (!ok) return
    await window.api.deleteCollection(collection.id)
    if (state.activeCollectionId === collection.id) {
      dispatch({ type: 'SET_COLLECTION', payload: null })
    }
    loadCollections()
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Collections</h2>
          <p className={styles.subtitle}>
            Groups of {activeModel?.name ?? 'this model'}&apos;s photos - shoots, sets, campaigns.
          </p>
        </div>
        <button className={styles.newBtn} onClick={() => setCreating(true)}>
          New collection
        </button>
      </div>

      {creating && (
        <div className={styles.createRow}>
          <input
            autoFocus
            className={styles.createInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') {
                setCreating(false)
                setName('')
              }
            }}
            placeholder="Collection name"
          />
          <button className={styles.createBtn} onClick={create}>
            Create
          </button>
        </div>
      )}

      {state.collections.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No collections yet</p>
          <p className={styles.emptyHint}>
            Create one, then drag photos onto its chip in the Photos tab.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {state.collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onOpen={() => dispatch({ type: 'SET_COLLECTION', payload: collection.id })}
              onDelete={() => remove(collection)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CollectionCardProps {
  collection: Collection
  onOpen: () => void
  onDelete: () => void
}

function CollectionCard({ collection, onOpen, onDelete }: CollectionCardProps): JSX.Element {
  return (
    <div className={styles.card} onClick={onOpen}>
      <div className={styles.cardName}>{collection.name}</div>
      <div className={styles.cardCount}>
        {collection.photoCount} photo{collection.photoCount !== 1 ? 's' : ''}
      </div>
      <button
        className={styles.cardDelete}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Delete collection"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
