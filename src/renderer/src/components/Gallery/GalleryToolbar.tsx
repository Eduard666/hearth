import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import TagInput from '../common/TagInput'
import styles from './GalleryToolbar.module.css'

export default function GalleryToolbar(): JSX.Element {
  const { state, dispatch, loadPhotos } = useApp()
  const [showTagInput, setShowTagInput] = useState(false)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)
  const [showPlatformPicker, setShowPlatformPicker] = useState(false)
  const selCount = state.selectedPhotoIds.length

  const handleAddTag = async (tag: string): Promise<void> => {
    if (selCount === 0) return
    await window.api.addTag(state.selectedPhotoIds, tag)
    loadPhotos()
  }

  const handleAddToCollection = async (collectionId: number): Promise<void> => {
    if (selCount === 0) return
    await window.api.addPhotosToCollection(state.selectedPhotoIds, collectionId)
    setShowCollectionPicker(false)
    loadPhotos()
  }

  const handleTogglePosted = async (destinationId: number, posted: boolean): Promise<void> => {
    if (selCount === 0) return
    await window.api.setPosted(state.selectedPhotoIds, destinationId, posted)
    loadPhotos()
  }

  const handleDelete = async (): Promise<void> => {
    if (selCount === 0) return
    for (const id of state.selectedPhotoIds) {
      await window.api.deletePhoto(id)
    }
    dispatch({ type: 'CLEAR_SELECTION' })
    loadPhotos()
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.photoCount}>
          {state.photos.length} photo{state.photos.length !== 1 ? 's' : ''}
        </span>
        {selCount > 0 && (
          <span className={styles.selCount}>{selCount} selected</span>
        )}
      </div>

      {selCount > 0 && (
        <div className={styles.actions}>
          {/* Tag button */}
          <div className={styles.relative}>
            <button
              className={styles.actionBtn}
              onClick={() => setShowTagInput((v) => !v)}
            >
              <TagIcon /> Tag
            </button>
            {showTagInput && (
              <div className={styles.dropdown}>
                <TagInput
                  existingTags={[]}
                  onAdd={handleAddTag}
                  placeholder="Add tag to selection"
                />
              </div>
            )}
          </div>

          {/* Collection button */}
          <div className={styles.relative}>
            <button
              className={styles.actionBtn}
              onClick={() => setShowCollectionPicker((v) => !v)}
            >
              <CollectionIcon /> Add to collection
            </button>
            {showCollectionPicker && (
              <div className={styles.dropdown}>
                {state.collections.length === 0 ? (
                  <div className={styles.dropdownEmpty}>No collections yet</div>
                ) : (
                  state.collections.map((c) => (
                    <button
                      key={c.id}
                      className={styles.dropdownItem}
                      onClick={() => handleAddToCollection(c.id)}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Platform status */}
          <div className={styles.relative}>
            <button
              className={styles.actionBtn}
              onClick={() => setShowPlatformPicker((v) => !v)}
            >
              <ShareIcon /> Mark posted
            </button>
            {showPlatformPicker && (
              <div className={styles.dropdown}>
                {state.destinations.map((d) => (
                  <div key={d.id} className={styles.platformRow}>
                    <span className={styles.platformDot} style={{ background: d.color }} />
                    <span className={styles.platformName}>{d.name}</span>
                    <button
                      className={styles.platformToggle}
                      onClick={() => handleTogglePosted(d.id, true)}
                    >
                      Posted
                    </button>
                    <button
                      className={styles.platformToggle}
                      onClick={() => handleTogglePosted(d.id, false)}
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete}>
            <TrashIcon /> Delete
          </button>

          {/* Clear selection */}
          <button className={styles.clearBtn} onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

function TagIcon(): JSX.Element {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
}

function CollectionIcon(): JSX.Element {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
}

function ShareIcon(): JSX.Element {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
}

function TrashIcon(): JSX.Element {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
}
