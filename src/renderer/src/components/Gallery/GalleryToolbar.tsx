import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import TagInput from '../common/TagInput'
import styles from './GalleryToolbar.module.css'

export default function GalleryToolbar(): JSX.Element {
  const { state, dispatch, activeModel, loadPhotos, loadCollections, loadModels } = useApp()
  const [showTagInput, setShowTagInput] = useState(false)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)
  const [showPlatformPicker, setShowPlatformPicker] = useState(false)
  const [showMovePicker, setShowMovePicker] = useState(false)
  const selCount = state.selectedPhotoIds.length

  const moveTargets = state.models.filter((m) => m.id !== state.activeModelId)

  const handleAddTag = async (tag: string): Promise<void> => {
    if (selCount === 0) return
    await window.api.addTag(state.selectedPhotoIds, tag)
    loadPhotos()
  }

  const handleAddToCollection = async (collectionId: number): Promise<void> => {
    if (selCount === 0) return
    await window.api.addPhotosToCollection(state.selectedPhotoIds, collectionId)
    setShowCollectionPicker(false)
    await Promise.all([loadPhotos(), loadCollections()])
  }

  // The escape hatch for photos imported into the wrong model.
  const handleMoveToModel = async (modelId: number): Promise<void> => {
    if (selCount === 0) return
    await window.api.movePhotosToModel(state.selectedPhotoIds, modelId)
    setShowMovePicker(false)
    dispatch({ type: 'CLEAR_SELECTION' })
    await Promise.all([loadPhotos(), loadCollections(), loadModels()])
  }

  const handleTogglePosted = async (destinationId: number, posted: boolean): Promise<void> => {
    if (selCount === 0) return
    await window.api.setPosted(state.selectedPhotoIds, destinationId, posted)
    loadPhotos()
  }

  const handleDelete = async (): Promise<void> => {
    if (selCount === 0) return
    const ok = window.confirm(
      `Remove ${selCount} photo${selCount !== 1 ? 's' : ''} from ${activeModel?.name ?? 'this model'}?`
    )
    if (!ok) return
    for (const id of state.selectedPhotoIds) {
      await window.api.deletePhoto(id)
    }
    dispatch({ type: 'CLEAR_SELECTION' })
    await Promise.all([loadPhotos(), loadCollections(), loadModels()])
  }

  return (
    <div className={styles.toolbar}>
      {/* The model name already sits in the space header - this row only reports the
          current view's count and whatever is selected. */}
      <div className={styles.left}>
        <span className={styles.photoCount}>
          {state.photos.length} photo{state.photos.length !== 1 ? 's' : ''}
        </span>
        {selCount > 0 && <span className={styles.selCount}>{selCount} selected</span>}
      </div>

      {selCount > 0 && (
        <div className={styles.actions}>
          <div className={styles.relative}>
            <button className={styles.actionBtn} onClick={() => setShowTagInput((v) => !v)}>
              <TagIcon /> Tag
            </button>
            {showTagInput && (
              <div className={styles.dropdown}>
                <TagInput existingTags={[]} onAdd={handleAddTag} placeholder="Add tag" />
              </div>
            )}
          </div>

          <div className={styles.relative}>
            <button className={styles.actionBtn} onClick={() => setShowCollectionPicker((v) => !v)}>
              <CollectionIcon /> Add to collection
            </button>
            {showCollectionPicker && (
              <div className={styles.dropdown}>
                {state.collections.length === 0 ? (
                  <div className={styles.dropdownEmpty}>No collections yet</div>
                ) : (
                  state.collections.map((c) => (
                    <button key={c.id} className={styles.dropdownItem} onClick={() => handleAddToCollection(c.id)}>
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className={styles.relative}>
            <button className={styles.actionBtn} onClick={() => setShowPlatformPicker((v) => !v)}>
              <ShareIcon /> Mark posted
            </button>
            {showPlatformPicker && (
              <div className={styles.dropdown}>
                {state.destinations.map((d) => (
                  <div key={d.id} className={styles.platformRow}>
                    <span className={styles.platformDot} style={{ background: d.color }} />
                    <span className={styles.platformName}>{d.name}</span>
                    <button className={styles.platformToggle} onClick={() => handleTogglePosted(d.id, true)}>
                      Posted
                    </button>
                    <button className={styles.platformToggle} onClick={() => handleTogglePosted(d.id, false)}>
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {moveTargets.length > 0 && (
            <div className={styles.relative}>
              <button className={styles.actionBtn} onClick={() => setShowMovePicker((v) => !v)}>
                <MoveIcon /> Move to model
              </button>
              {showMovePicker && (
                <div className={styles.dropdown}>
                  {moveTargets.map((m) => (
                    <button
                      key={m.id}
                      className={styles.dropdownItem}
                      onClick={() => handleMoveToModel(m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete}>
            <TrashIcon /> Delete
          </button>

          <button className={styles.clearBtn} onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

function MoveIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></svg>
}

function TagIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
}

function CollectionIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
}

function ShareIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
}

function TrashIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
}
