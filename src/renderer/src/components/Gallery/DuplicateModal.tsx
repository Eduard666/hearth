import type { ImportResult } from '../../../../shared/types'
import styles from './DuplicateModal.module.css'

interface DuplicateModalProps {
  result: ImportResult
  onClose: () => void
}

export default function DuplicateModal({ result, onClose }: DuplicateModalProps): JSX.Element {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Import complete</h2>
          <button className={styles.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{result.imported}</span>
            <span className={styles.statLabel}>Imported</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{result.skipped}</span>
            <span className={styles.statLabel}>Skipped</span>
          </div>
          {result.duplicates.length > 0 && (
            <div className={styles.stat}>
              <span className={`${styles.statNum} ${styles.warn}`}>{result.duplicates.length}</span>
              <span className={styles.statLabel}>Exact duplicates</span>
            </div>
          )}
          {result.nearDuplicates.length > 0 && (
            <div className={styles.stat}>
              <span className={`${styles.statNum} ${styles.warn}`}>{result.nearDuplicates.length}</span>
              <span className={styles.statLabel}>Near duplicates</span>
            </div>
          )}
        </div>

        {result.heicFiles.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>HEIC files detected</h3>
            <p className={styles.hint}>
              {result.heicFiles.length} HEIC file{result.heicFiles.length !== 1 ? 's' : ''} were
              imported. They are being decoded in the background and will appear in the grid as
              each one finishes.
            </p>
          </div>
        )}

        {result.nearDuplicates.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Near duplicates flagged</h3>
            <div className={styles.list}>
              {result.nearDuplicates.slice(0, 5).map((nd, i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listFile}>{nd.incoming.split(/[\\/]/).pop()}</span>
                  <span className={styles.listDist}>distance {nd.distance}</span>
                </div>
              ))}
              {result.nearDuplicates.length > 5 && (
                <div className={styles.listMore}>+{result.nearDuplicates.length - 5} more</div>
              )}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
