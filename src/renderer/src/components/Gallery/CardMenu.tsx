import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from './CardMenu.module.css'

interface CardMenuProps {
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}

/**
 * Popover anchored to a point in the viewport.
 *
 * Rendered above the gallery rather than inside a card: the grid is virtualized, so a
 * menu living in a card would be unmounted the moment its row scrolled out of view.
 */
export default function CardMenu({ x, y, onClose, children }: CardMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Flip back inside the window when opened near an edge.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - height - margin))
    })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        className={styles.menu}
        style={{ left: position.left, top: position.top }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  )
}
