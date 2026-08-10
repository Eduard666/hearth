import { useState, useCallback, useEffect, useRef } from 'react'
import type { FileTreeNode } from '../../../../shared/types'
import styles from './FileTree.module.css'

interface FileTreeProps {
  nodes: FileTreeNode[]
  onSelect: (path: string) => void
  activePath?: string
}

export default function FileTree({ nodes, onSelect, activePath }: FileTreeProps): JSX.Element {
  return (
    <div className={styles.tree} role="tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onSelect={onSelect}
          activePath={activePath}
        />
      ))}
    </div>
  )
}

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  onSelect: (path: string) => void
  activePath?: string
}

function TreeNode({ node, depth, onSelect, activePath }: TreeNodeProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = activePath === node.path
  const hasChildren = node.isDirectory && node.children.length > 0
  const indentPx = depth * 12 + 12

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded((v) => !v)
      onSelect(node.path)
    } else {
      onSelect(node.path)
    }
  }, [node, onSelect])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
      if (e.key === 'ArrowRight' && node.isDirectory && !expanded) {
        e.preventDefault()
        setExpanded(true)
      }
      if (e.key === 'ArrowLeft' && node.isDirectory && expanded) {
        e.preventDefault()
        setExpanded(false)
      }
    },
    [handleClick, node.isDirectory, expanded]
  )

  return (
    <div className={styles.node} role="treeitem" aria-expanded={node.isDirectory ? expanded : undefined}>
      <div
        ref={ref}
        className={`${styles.row} ${isActive ? styles.active : ''}`}
        style={{ paddingLeft: indentPx }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        title={node.name}
      >
        {node.isDirectory && (
          <span className={`${styles.chevron} ${expanded ? styles.expanded : ''}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        )}
        <span className={styles.icon}>
          {node.isDirectory ? <FolderIcon open={expanded} /> : <ImageIcon />}
        </span>
        <span className={styles.name}>{node.name}</span>
        {node.isDirectory && node.photoCount != null && node.photoCount > 0 && (
          <span className={styles.count}>{node.photoCount}</span>
        )}
      </div>
      {node.isDirectory && expanded && hasChildren && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={open ? 'var(--accent)' : 'none'} stroke={open ? 'var(--accent)' : 'currentColor'} strokeWidth="1.5">
      {open ? (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      ) : (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      )}
    </svg>
  )
}

function ImageIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}
