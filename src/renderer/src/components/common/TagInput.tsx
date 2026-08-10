import { useState, useRef } from 'react'
import styles from './TagInput.module.css'

interface TagInputProps {
  existingTags: string[]
  onAdd: (tag: string) => void
  onRemove?: (tag: string) => void
  placeholder?: string
  showTags?: boolean
}

export default function TagInput({
  existingTags,
  onAdd,
  onRemove,
  placeholder = 'Add tag',
  showTags = true
}: TagInputProps): JSX.Element {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = (): void => {
    const tag = value.trim().toLowerCase()
    if (!tag) return
    onAdd(tag)
    setValue('')
  }

  return (
    <div className={styles.container}>
      {showTags && existingTags.length > 0 && (
        <div className={styles.tags}>
          {existingTags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
              {onRemove && (
                <button className={styles.removeTag} onClick={() => onRemove(tag)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={placeholder}
        />
        <button className={styles.addBtn} onClick={commit} disabled={!value.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
