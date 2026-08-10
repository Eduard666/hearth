import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Photo, PlatformDestination } from '../../../../shared/types'
import styles from './PhotoCard.module.css'

interface PhotoCardProps {
  photo: Photo
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  destinations: PlatformDestination[]
  onRefresh: () => void
}

export default function PhotoCard({
  photo,
  selected,
  onClick,
  destinations,
  onRefresh
}: PhotoCardProps): JSX.Element {
  const [showMenu, setShowMenu] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: photo.id })

  const displaySrc = photo.convertedPath ?? photo.thumbnailPath ?? photo.filePath
  const isHeic = ['.heic', '.heif', '.hif'].includes(photo.originalExt.toLowerCase())
  const needsConversion = isHeic && !photo.convertedPath

  const handleConvert = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await window.api.convertHeic(photo.id, 'jpeg')
    onRefresh()
  }

  const togglePosted = async (e: React.MouseEvent, destinationId: number, currentlyPosted: boolean): Promise<void> => {
    e.stopPropagation()
    await window.api.setPosted([photo.id], destinationId, !currentlyPosted)
    onRefresh()
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${styles.card} ${selected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true) }}
    >
      {/* Thumbnail */}
      <div className={styles.thumb}>
        {needsConversion ? (
          <div className={styles.heicPlaceholder}>
            <span>HEIC</span>
            <button className={styles.convertBtn} onClick={handleConvert}>
              Convert
            </button>
          </div>
        ) : (
          <img
            src={`file://${displaySrc}`}
            alt=""
            className={styles.img}
            draggable={false}
            loading="lazy"
          />
        )}

        {/* Selection check */}
        {selected && (
          <div className={styles.checkmark}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Platform status badges */}
      {destinations.length > 0 && (
        <div className={styles.badges}>
          {destinations.map((dest) => {
            const status = photo.platformStatuses.find((s) => s.destinationId === dest.id)
            const posted = status?.posted ?? false
            return (
              <button
                key={dest.id}
                className={`${styles.badge} ${posted ? styles.badgePosted : styles.badgeUnposted}`}
                style={posted ? { backgroundColor: dest.color, borderColor: dest.color } : {}}
                onClick={(e) => togglePosted(e, dest.id, posted)}
                title={`${posted ? 'Posted' : 'Not posted'} on ${dest.name}`}
              >
                {dest.name[0]}
              </button>
            )
          })}
        </div>
      )}

      {/* Filename */}
      <div className={styles.name} title={photo.filePath.split(/[\\/]/).pop()}>
        {photo.filePath.split(/[\\/]/).pop()}
      </div>

      {/* Tags preview */}
      {photo.tags.length > 0 && (
        <div className={styles.tags}>
          {photo.tags.slice(0, 3).map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
          {photo.tags.length > 3 && (
            <span className={styles.tagMore}>+{photo.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
