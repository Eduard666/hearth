import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
import PhotoCard, { type CardMenuKind } from './PhotoCard'
import GalleryToolbar from './GalleryToolbar'
import CollectionChips from './CollectionChips'
import DuplicateModal from './DuplicateModal'
import CardMenu from './CardMenu'
import PostedMenu from './PostedMenu'
import PhotoActionsMenu from './PhotoActionsMenu'
import { useVirtualGrid } from './useVirtualGrid'
import type { ImportResult, Photo } from '../../../../shared/types'
import styles from './Gallery.module.css'

interface OpenMenu {
  kind: CardMenuKind
  photoId: number
  x: number
  y: number
}

// Kept in sync with Gallery.module.css / PhotoCard.module.css: the virtualizer needs
// concrete numbers to derive row height from the measured column width.
const GRID_GAP = 12
const GRID_PADDING = 16
const MIN_COLUMN_WIDTH = 180
const CARD_META_HEIGHT = 44

interface GalleryProps {
  /** Opens the model-scoped import picker from the empty state. */
  onImport: () => void
}

export default function Gallery({ onImport }: GalleryProps): JSX.Element {
  const { state, dispatch, activeModel, loadPhotos, loadCollections, loadModels } = useApp()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const lastClickedId = useRef<number | null>(null)

  const grid = useVirtualGrid(scroller, {
    itemCount: state.photos.length,
    minColumnWidth: MIN_COLUMN_WIDTH,
    gap: GRID_GAP,
    padding: GRID_PADDING,
    metaHeight: CARD_META_HEIGHT
  })

  // A new filter is a new list; keeping the old scroll offset would land mid-nowhere.
  useEffect(() => {
    scroller?.scrollTo({ top: 0 })
  }, [state.activeModelId, state.activeCollectionId, scroller])

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

  // Menus act on the whole selection when the click landed inside it, and otherwise on
  // just the photo that was clicked - the behaviour people expect from a file manager.
  const openMenu = useCallback(
    (kind: CardMenuKind, photo: Photo, x: number, y: number) => {
      if (!state.selectedPhotoIds.includes(photo.id)) {
        dispatch({ type: 'SELECT_PHOTOS', payload: [photo.id] })
      }
      setMenu({ kind, photoId: photo.id, x, y })
    },
    [state.selectedPhotoIds, dispatch]
  )

  const menuPhotos = useMemo(() => {
    if (!menu) return []
    const selected = state.photos.filter((p) => state.selectedPhotoIds.includes(p.id))
    if (selected.some((p) => p.id === menu.photoId)) return selected
    const single = state.photos.find((p) => p.id === menu.photoId)
    return single ? [single] : []
  }, [menu, state.photos, state.selectedPhotoIds])

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
      if (!activeModel) return

      // Electron 32+ removed `File.path`; paths must come from webUtils via the preload.
      const paths = Array.from(e.dataTransfer.files).map((f) => window.api.getPathForFile(f))
      if (paths.length === 0) return

      // Dropped files land in the open model, never in a shared pool.
      const result = await window.api.importPhotos(paths, activeModel.id)
      setImportResult(result)
      await Promise.all([loadPhotos(), loadModels()])
    },
    [activeModel, loadPhotos, loadModels]
  )

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const activePhoto = activeId ? state.photos.find((p) => p.id === activeId) : null
  const visiblePhotos = state.photos.slice(grid.startIndex, grid.endIndex)

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.wrapper}>
        <GalleryToolbar />
        <CollectionChips />

        {state.thumbnailProgress && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${(state.thumbnailProgress.done / state.thumbnailProgress.total) * 100}%`
              }}
            />
            <span className={styles.progressLabel}>
              Preparing previews {state.thumbnailProgress.done} of {state.thumbnailProgress.total}
            </span>
          </div>
        )}

        {state.photos.length === 0 ? (
          <div
            className={styles.emptyState}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className={styles.emptyIcon}>
              <DropIcon />
            </div>
            <p className={styles.emptyTitle}>
              {state.activeCollectionId != null
                ? 'Nothing in this collection yet'
                : `Drop photos here to add them to ${activeModel?.name ?? 'this model'}`}
            </p>
            <p className={styles.emptySubtitle}>
              {state.activeCollectionId != null
                ? 'Drag photos onto the collection chip above to fill it.'
                : 'Everything you import here belongs to this model only.'}
            </p>
            {state.activeCollectionId == null && (
              <button className={styles.emptyAction} onClick={onImport}>
                Choose photos
              </button>
            )}
          </div>
        ) : (
          <div
            ref={setScroller}
            className={styles.scroller}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={(e) => {
              if (e.target === e.currentTarget) dispatch({ type: 'CLEAR_SELECTION' })
            }}
          >
            <div
              className={styles.sizer}
              style={{ height: grid.totalHeight + GRID_PADDING * 2 }}
            >
              <div
                className={styles.grid}
                style={{
                  top: GRID_PADDING + grid.offsetY,
                  gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`
                }}
              >
                {visiblePhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    selected={state.selectedPhotoIds.includes(photo.id)}
                    onClick={(e) => handleCardClick(photo.id, e)}
                    onOpenMenu={openMenu}
                    onRefresh={loadPhotos}
                  />
                ))}
              </div>
            </div>
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

      {menu && menuPhotos.length > 0 && (
        <CardMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {menu.kind === 'posted' ? (
            <PostedMenu
              photos={menuPhotos}
              onDone={loadPhotos}
              onClose={() => setMenu(null)}
            />
          ) : (
            <PhotoActionsMenu
              photos={menuPhotos}
              onDone={loadPhotos}
              onClose={() => setMenu(null)}
            />
          )}
        </CardMenu>
      )}

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
