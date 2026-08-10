import { useEffect, useState } from 'react'

export interface GridGeometry {
  columns: number
  /** Height of one row including the gap that follows it. */
  rowHeight: number
  /** Full scrollable height, so the scrollbar reflects the whole library. */
  totalHeight: number
  /** Pixel offset of the first rendered row from the top of the content area. */
  offsetY: number
  startIndex: number
  endIndex: number
}

interface Options {
  itemCount: number
  minColumnWidth: number
  gap: number
  padding: number
  /** Fixed height of the card below its square thumbnail. */
  metaHeight: number
  overscanRows?: number
}

/**
 * Windows a uniform grid so only the rows near the viewport are mounted.
 *
 * Cards are a fixed aspect (square thumbnail + fixed-height meta block), which means row
 * height is derived from the measured column width instead of needing per-item measurement.
 */
export function useVirtualGrid(
  scroller: HTMLElement | null,
  { itemCount, minColumnWidth, gap, padding, metaHeight, overscanRows = 2 }: Options
): GridGeometry {
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    if (!scroller) return

    const measure = (): void =>
      setViewport({ width: scroller.clientWidth, height: scroller.clientHeight })

    measure()
    setScrollTop(scroller.scrollTop)

    const observer = new ResizeObserver(measure)
    observer.observe(scroller)

    const onScroll = (): void => setScrollTop(scroller.scrollTop)
    scroller.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [scroller])

  const contentWidth = Math.max(0, viewport.width - padding * 2)

  if (contentWidth === 0 || itemCount === 0) {
    return {
      columns: 1,
      rowHeight: 0,
      totalHeight: 0,
      offsetY: 0,
      startIndex: 0,
      // Render a first batch before measurement lands so the grid is never blank for a frame.
      endIndex: contentWidth === 0 ? Math.min(itemCount, 24) : 0
    }
  }

  const columns = Math.max(1, Math.floor((contentWidth + gap) / (minColumnWidth + gap)))
  const columnWidth = (contentWidth - gap * (columns - 1)) / columns
  const rowHeight = columnWidth + metaHeight + gap
  const rowCount = Math.ceil(itemCount / columns)

  const firstVisibleRow = Math.floor(scrollTop / rowHeight)
  const lastVisibleRow = Math.ceil((scrollTop + viewport.height) / rowHeight)

  const startRow = Math.max(0, firstVisibleRow - overscanRows)
  const endRow = Math.min(rowCount, lastVisibleRow + overscanRows)

  return {
    columns,
    rowHeight,
    // Trailing gap is dropped so the last row sits flush against the bottom padding.
    totalHeight: Math.max(0, rowCount * rowHeight - gap),
    offsetY: startRow * rowHeight,
    startIndex: startRow * columns,
    endIndex: Math.min(itemCount, endRow * columns)
  }
}
