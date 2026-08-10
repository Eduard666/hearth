import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Photo } from '../../../../shared/types'
import { mediaUrl } from '../../../../shared/media'
import styles from './PhotoCard.module.css'

export type CardMenuKind = 'actions' | 'posted'

interface PhotoCardProps {
  photo: Photo
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onOpenMenu: (kind: CardMenuKind, photo: Photo, x: number, y: number) => void
  onRefresh: () => void
}

export default function PhotoCard({
  photo,
  selected,
  onClick,
  onOpenMenu,
  onRefresh
}: PhotoCardProps): JSX.Element {
  const [converting, setConverting] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: photo.id })

  const fileName = photo.filePath.split(/[\\/]/).pop()
  const isHeic = ['.heic', '.heif', '.hif'].includes(photo.originalExt.toLowerCase())
  // Chromium can render the original for everything except HEIC, which needs the decoded copy.
  const displayPath =
    photo.thumbnailPath ?? photo.convertedPath ?? (isHeic ? null : photo.filePath)

  const posted = photo.posts.length > 0

  const handleConvert = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    setConverting(true)
    try {
      await window.api.convertHeic(photo.id)
      onRefresh()
    } finally {
      setConverting(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${styles.card} ${selected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpenMenu('posted', photo, e.clientX, e.clientY)
      }}
    >
      <div className={styles.thumb}>
        {displayPath ? (
          <img
            src={mediaUrl(displayPath)}
            alt=""
            className={styles.img}
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className={styles.heicPlaceholder}>
            <span>{photo.originalExt.replace('.', '').toUpperCase()}</span>
            <button className={styles.convertBtn} onClick={handleConvert} disabled={converting}>
              {converting ? 'Converting…' : 'Convert now'}
            </button>
          </div>
        )}

        {/* Selection check */}
        {selected && (
          <div className={styles.checkmark}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {/* Posted indicator - where it went and when */}
        {posted && (
          <div className={styles.postedBadge} title={postedSummary(photo)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        <button
          className={styles.menuBtn}
          title="Photo options"
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            onOpenMenu('actions', photo, rect.right, rect.bottom)
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="19" r="1.7" />
          </svg>
        </button>
      </div>

      {/* Fixed-height meta block - the virtualized grid needs uniform card heights */}
      <div className={styles.meta}>
        <div className={styles.name} title={fileName}>
          {fileName}
        </div>

        {posted && (
          <div className={styles.postTags}>
            {photo.posts.slice(0, 2).map((post) => (
              <span
                key={post.tagId}
                className={styles.postTag}
                style={{ borderColor: post.tagColor, color: post.tagColor }}
                title={`${post.tagName} · ${formatDate(post.postedAt)}`}
              >
                {post.tagName}
              </span>
            ))}
            {photo.posts.length > 2 && (
              <span className={styles.postTagMore}>+{photo.posts.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function postedSummary(photo: Photo): string {
  return photo.posts
    .map((post) => `${post.tagName} · ${formatDate(post.postedAt)}`)
    .join('\n')
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
