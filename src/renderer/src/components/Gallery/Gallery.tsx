import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import { useApp } from '../../context/AppContext'
import PhotoCard from './PhotoCard'
import GalleryToolbar from './GalleryToolbar'
import DuplicateModal from './DuplicateModal'
import type { Photo, ImportResult } from '../../../../shared/types'
import styles from './Gallery.module.css'

export default function Gallery(): JSX.Element {
  const { state, dispatch, loadPhotos, loadCollections } = useApp()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const lastClickedId = useRef<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleCardClick = useCallback(
    (id: number, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        dispatch({ type: 'TOGGLE_SELECT', payload: id })
      } else if (e.shiftKey && lastClickedId.current != null) {
        const allIds = state.photos.map((p) => p.id)
        dispatch({
          type: 'SELECT_RANGE',
          payload: { from: lastClickedId.current, to: id, allIds }
        })
      } else {
        dispatch({ type: 'SELECT_PHOTOS', payload: [id] })
      }
      lastClickedId.current = id
    },
    [state.photos, dispatch]
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const id = event.active.id as number
    if (!state.selectedPhotoIds.includes(id)) {
      dispatch({ type: 'SELECT_PHOTOS', payload: [id] })
    }
    setActiveId(id)
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveId(null)
    const { over } = event
    if (!over) return

    const collectionId = over.data.current?.collectionId as number | undefined
    if (collectionId != null) {
      const ids = state.selectedPhotoIds.length > 0 ? state.selectedPhotoIds : [event.active.id as number]
      await window.api.addPhotosToCollection(ids, collectionId)
      loadCollections()
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const paths = Array.from(e.dataTransfer.files).map((f) => f.path)
      if (paths.length === 0) return

      const result = await window.api.importPhotos(paths)
      setImportResult(result)
      loadPhotos()
    },
    [loadPhotos]
  )

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const activePhoto = activeId ? state.photos.find((p) => p.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.wrapper}>
        <GalleryToolbar />
        {state.photos.length === 0 ? (
          <div
            className={styles.emptyState}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className={styles.emptyIcon}>
              <DropIcon />
            </div>
            <p className={styles.emptyTitle}>Drop photos here to import</p>
            <p className={styles.emptySubtitle}>Or use the import buttons in the sidebar</p>
          </div>
        ) : (
          <div
            className={styles.grid}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={(e) => {
              if (e.target === e.currentTarget) dispatch({ type: 'CLEAR_SELECTION' })
            }}
          >
            {state.photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                selected={state.selectedPhotoIds.includes(photo.id)}
                onClick={(e) => handleCardClick(photo.id, e)}
                destinations={state.destinations}
                onRefresh={loadPhotos}
              />
            ))}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activePhoto && (
            <div className={`${styles.dragOverlay} drag-overlay`}>
              <div className={styles.dragCount}>
                {state.selectedPhotoIds.length > 1 ? state.selectedPhotoIds.length : 1}
              </div>
            </div>
          )}
        </DragOverlay>
      </div>

      {importResult && (
        <DuplicateModal
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}
    </DndContext>
  )
}

function DropIcon(): JSX.Element {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}
