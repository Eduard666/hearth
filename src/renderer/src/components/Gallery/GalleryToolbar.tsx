import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import styles from './GalleryToolbar.module.css'

export default function GalleryToolbar(): JSX.Element {
  const { state, dispatch, activeModel, loadPhotos, loadCollections, loadModels } = useApp()
  const [showMovePicker, setShowMovePicker] = useState(false)
  const selCount = state.selectedPhotoIds.length

  const moveTargets = state.models.filter((m) => m.id !== state.activeModelId)

  // The escape hatch for photos imported into the wrong model.
  const handleMoveToModel = async (modelId: number): Promise<void> => {
    if (selCount === 0) return
    await window.api.movePhotosToModel(state.selectedPhotoIds, modelId)
    setShowMovePicker(false)
    dispatch({ type: 'CLEAR_SELECTION' })
    await Promise.all([loadPhotos(), loadCollections(), loadModels()])
  }

  const handleRemoveFromCollection = async (): Promise<void> => {
    if (selCount === 0 || state.activeCollectionId == null) return
    await window.api.removePhotosFromCollection(state.selectedPhotoIds, state.activeCollectionId)
    dispatch({ type: 'CLEAR_SELECTION' })
    await Promise.all([loadPhotos(), loadCollections()])
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
        {selCount > 0 ? (
          <span className={styles.selCount}>{selCount} selected</span>
        ) : (
          <span className={styles.hint}>Right-click a photo to mark where it was posted</span>
        )}
      </div>

      {selCount > 0 && (
        <div className={styles.actions}>
          {state.activeCollectionId != null && (
            <button className={styles.actionBtn} onClick={handleRemoveFromCollection}>
              <RemoveIcon /> Remove from collection
            </button>
          )}

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

function RemoveIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
}

function TrashIcon(): JSX.Element {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
}
