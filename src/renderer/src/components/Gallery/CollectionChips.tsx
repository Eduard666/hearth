import { useDroppable } from '@dnd-kit/core'
import { useApp } from '../../context/AppContext'
import type { Collection } from '../../../../shared/types'
import styles from './CollectionChips.module.css'

/**
 * Collections of the open model, shown alongside the grid so they can be both a filter
 * and a drop target. They have to live in the Photos tab: the drag context is here.
 */
export default function CollectionChips(): JSX.Element | null {
  const { state, dispatch } = useApp()
  if (state.collections.length === 0) return null

  return (
    <div className={styles.strip}>
      <button
        className={`${styles.chip} ${state.activeCollectionId == null ? styles.chipActive : ''}`}
        onClick={() => dispatch({ type: 'SET_COLLECTION', payload: null })}
      >
        All photos
      </button>
      {state.collections.map((collection) => (
        <CollectionChip
          key={collection.id}
          collection={collection}
          active={state.activeCollectionId === collection.id}
          onSelect={() => dispatch({ type: 'SET_COLLECTION', payload: collection.id })}
        />
      ))}
    </div>
  )
}

interface CollectionChipProps {
  collection: Collection
  active: boolean
  onSelect: () => void
}

function CollectionChip({ collection, active, onSelect }: CollectionChipProps): JSX.Element {
  const { isOver, setNodeRef } = useDroppable({
    id: `collection-${collection.id}`,
    data: { collectionId: collection.id }
  })

  return (
    <button
      ref={setNodeRef}
      className={`${styles.chip} ${active ? styles.chipActive : ''} ${isOver ? styles.chipOver : ''}`}
      onClick={onSelect}
    >
      {collection.name}
      <span className={styles.chipCount}>{collection.photoCount}</span>
    </button>
  )
}
