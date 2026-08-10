import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatDate } from './PhotoCard'
import type { Photo } from '../../../../shared/types'
import styles from './CardMenu.module.css'

interface PostedMenuProps {
  /** The photos the action applies to - the selection when the click landed inside it. */
  photos: Photo[]
  onDone: () => void
  onClose: () => void
}

/**
 * Right-click menu for recording where a photo was published. Picking a tag stamps the
 * date automatically, so the user never has to remember when something went out.
 */
export default function PostedMenu({ photos, onDone, onClose }: PostedMenuProps): JSX.Element {
  const { state, loadTags } = useApp()
  const [creating, setCreating] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [busy, setBusy] = useState(false)

  const photoIds = photos.map((p) => p.id)
  const single = photos.length === 1 ? photos[0] : null

  // With several photos selected, a tag only counts as set if every one of them has it.
  const postedOn = (tagId: number): boolean =>
    photos.length > 0 && photos.every((p) => p.posts.some((post) => post.tagId === tagId))

  const dateFor = (tagId: number): string | null => {
    const post = single?.posts.find((p) => p.tagId === tagId)
    return post ? formatDate(post.postedAt) : null
  }

  const toggle = async (tagId: number): Promise<void> => {
    setBusy(true)
    try {
      if (postedOn(tagId)) {
        await window.api.unmarkPosted(photoIds, tagId)
      } else {
        await window.api.markPosted(photoIds, tagId)
      }
      await loadTags()
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const createAndMark = async (): Promise<void> => {
    const name = newTag.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const tag = await window.api.createTag(name)
      await window.api.markPosted(photoIds, tag.id)
      setNewTag('')
      setCreating(false)
      await loadTags()
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={styles.header}>
        {photos.length > 1 ? `Mark ${photos.length} photos as posted` : 'Mark as posted'}
      </div>

      {state.tags.length === 0 ? (
        <div className={styles.empty}>
          No tags yet. Create one for each place you post - a subreddit, a platform.
        </div>
      ) : (
        <div className={styles.list}>
          {state.tags.map((tag) => {
            const on = postedOn(tag.id)
            const date = dateFor(tag.id)
            return (
              <button
                key={tag.id}
                className={`${styles.item} ${on ? styles.itemOn : ''}`}
                onClick={() => toggle(tag.id)}
                disabled={busy}
              >
                <span className={styles.check}>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className={styles.dot} style={{ background: tag.color }} />
                <span className={styles.itemName}>{tag.name}</span>
                {date && <span className={styles.itemDate}>{date}</span>}
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.divider} />

      {creating || state.tags.length === 0 ? (
        <div className={styles.createRow}>
          <input
            autoFocus
            className={styles.createInput}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAndMark()
              if (e.key === 'Escape') {
                setCreating(false)
                setNewTag('')
              }
            }}
            placeholder="e.g. r/RealGirls"
          />
          <button className={styles.createBtn} onClick={createAndMark} disabled={!newTag.trim() || busy}>
            Add
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
          <span className={styles.itemName}>New tag…</span>
        </button>
      )}

      <button className={styles.closeRow} onClick={onClose}>
        Done
      </button>
    </>
  )
}
