const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6'
]

/** Stable per-id colour so a model keeps the same avatar everywhere it appears. */
export function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}
