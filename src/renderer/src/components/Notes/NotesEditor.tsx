import { useState, useEffect, useCallback } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { useTheme } from '../../context/ThemeContext'
import type { Note } from '../../../../shared/types'
import styles from './NotesEditor.module.css'

/** Notes always belong to a model - there is no global notes view. */
export interface NoteTarget {
  kind: 'model'
  id: number
  name: string
}

interface NotesEditorProps {
  target: NoteTarget
}

export default function NotesEditor({ target }: NotesEditorProps): JSX.Element {
  const { resolved } = useTheme()
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [titleValue, setTitleValue] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const editor = useCreateBlockNote()

  const loadNotes = useCallback(async (modelId: number) => {
    const fetched = await window.api.getNotes({ modelId })
    setNotes(fetched)
  }, [])

  useEffect(() => {
    setActiveNote(null)
    loadNotes(target.id)
  }, [target.id, loadNotes])

  useEffect(() => {
    if (activeNote) {
      setTitleValue(activeNote.title)
      try {
        const blocks = JSON.parse(activeNote.content)
        editor.replaceBlocks(editor.document, blocks)
      } catch {
        editor.replaceBlocks(editor.document, [])
      }
      setDirty(false)
    }
  }, [activeNote?.id])

  const scheduleAutosave = useCallback(() => {
    setDirty(true)
    if (saveTimeout) clearTimeout(saveTimeout)
    const t = setTimeout(async () => {
      if (!activeNote) return
      const blocks = editor.document
      const updated = await window.api.updateNote(
        activeNote.id,
        titleValue,
        JSON.stringify(blocks)
      )
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setDirty(false)
    }, 800)
    setSaveTimeout(t)
  }, [activeNote, titleValue, editor, saveTimeout])

  const createNote = async (): Promise<void> => {
    const note = await window.api.createNote({
      title: 'Untitled note',
      content: '[]',
      collectionId: null,
      modelId: target.id
    })
    setNotes((prev) => [note, ...prev])
    setActiveNote(note)
  }

  const deleteNote = async (id: number): Promise<void> => {
    await window.api.deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeNote?.id === id) setActiveNote(null)
  }

  return (
    <div className={styles.layout}>
      {/* Left column - target picker + note list */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>{target.name}&apos;s notes</span>
          <button className={styles.newBtn} onClick={createNote} title="New note">
            <PlusIcon />
          </button>
        </div>

        {/* Note list */}
        <div className={styles.noteList}>
          {notes.length === 0 ? (
            <div className={styles.emptyList}>No notes yet. Click + to create one.</div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`${styles.noteItem} ${activeNote?.id === note.id ? styles.noteActive : ''}`}
                onClick={() => setActiveNote(note)}
              >
                <div className={styles.noteItemTitle}>
                  {note.title || 'Untitled note'}
                </div>
                <div className={styles.noteItemDate}>
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
                <button
                  className={styles.deleteNote}
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
                  title="Delete note"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className={styles.editorArea}>
        {activeNote ? (
          <>
            <div className={styles.editorHeader}>
              <input
                className={styles.titleInput}
                value={titleValue}
                onChange={(e) => { setTitleValue(e.target.value); scheduleAutosave() }}
                placeholder="Note title"
              />
              <span className={styles.saveIndicator}>{dirty ? 'Saving...' : 'Saved'}</span>
            </div>
            <div className={styles.editorBody}>
              <BlockNoteView
                editor={editor}
                theme={resolved}
                onChange={scheduleAutosave}
              />
            </div>
          </>
        ) : (
          <div className={styles.emptyEditor}>
            <NoteIllustration />
            <p>Select a note or create a new one</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function NoteIllustration(): JSX.Element {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
