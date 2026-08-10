import { copyFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { app } from 'electron'
import { getDb } from './db'
import { computeSha256, computePerceptualHash, hammingDistance } from './hash'
import { isHeicFile } from './heic'
import { backfillThumbnails } from './thumbnails'
import type { ImportResult, Photo } from '../shared/types'

const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.heic', '.heif', '.hif'
])

export async function importPhotos(paths: string[], modelId: number): Promise<ImportResult> {
  const db = getDb()

  const model = db.prepare('SELECT id FROM models WHERE id = ?').get(modelId)
  if (!model) throw new Error(`Cannot import: model ${modelId} does not exist`)

  const settings = getSettings()
  const importMode = settings.importMode as 'copy' | 'reference'
  const threshold = parseInt(settings.nearDuplicateThreshold, 10)

  const allFiles = collectImageFiles(paths)
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    duplicates: [],
    nearDuplicates: [],
    heicFiles: []
  }

  // Duplicate detection is per model: the same file may legitimately appear in two
  // models' spaces, and an agency only cares about repeats within one model's set.
  const existingRows = db.prepare(
    `SELECT id, model_id, file_path, sha256, perceptual_hash, width, height, file_size,
            import_date, original_ext, converted_path, thumbnail_path
     FROM photos WHERE model_id = ?`
  ).all(modelId) as RawPhotoRow[]

  for (const filePath of allFiles) {
    const ext = extname(filePath).toLowerCase()
    const heic = isHeicFile(filePath)

    if (heic) result.heicFiles.push(filePath)

    try {
      const sha256 = await computeSha256(filePath)

      const exactDup = existingRows.find((r) => r.sha256 === sha256)
      if (exactDup) {
        result.duplicates.push({ incoming: filePath, existing: rowToPhoto(exactDup) })
        result.skipped++
        continue
      }

      // HEIC cannot be hashed until it is decoded; the background pass fills in a real
      // hash once it has produced a JPEG thumbnail.
      const phash = await computePerceptualHash(filePath)

      const nearDup = existingRows.find((r) => {
        if (!r.perceptual_hash || r.perceptual_hash === '0'.repeat(64)) return false
        return hammingDistance(phash, r.perceptual_hash) <= threshold
      })

      if (nearDup) {
        result.nearDuplicates.push({
          incoming: filePath,
          existing: rowToPhoto(nearDup),
          distance: hammingDistance(phash, nearDup.perceptual_hash)
        })
      }

      let storedPath = filePath
      if (importMode === 'copy') {
        storedPath = copyIntoLibrary(filePath, modelId)
      }

      const stat = statSync(filePath)
      const now = new Date().toISOString()

      // Dimensions and thumbnails are left to the background pass: decoding here would
      // make importing a folder of HEICs take minutes before anything appears on screen.
      const row = db.prepare(`
        INSERT INTO photos (model_id, file_path, sha256, perceptual_hash, width, height, file_size, import_date, original_ext, converted_path, thumbnail_path)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, NULL, NULL)
      `).run(modelId, storedPath, sha256, phash, stat.size, now, ext)

      existingRows.push({
        id: row.lastInsertRowid as number,
        model_id: modelId,
        file_path: storedPath,
        sha256,
        perceptual_hash: phash,
        width: 0,
        height: 0,
        file_size: stat.size,
        import_date: now,
        original_ext: ext,
        converted_path: null,
        thumbnail_path: null
      })

      result.imported++
    } catch (err) {
      console.error(`Import error for ${filePath}:`, err)
      result.skipped++
    }
  }

  if (result.imported > 0) void backfillThumbnails()

  return result
}

/**
 * Copies into a per-model folder so two models can hold files with the same name, and
 * suffixes on collision so an import never silently overwrites an earlier photo.
 */
function copyIntoLibrary(filePath: string, modelId: number): string {
  const copyDir = join(app.getPath('userData'), 'library', `model-${modelId}`)
  mkdirSync(copyDir, { recursive: true })

  const name = basename(filePath)
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)

  let destPath = join(copyDir, name)
  let suffix = 1
  while (existsSync(destPath)) {
    destPath = join(copyDir, `${stem}_${suffix}${ext}`)
    suffix++
  }

  copyFileSync(filePath, destPath)
  return destPath
}

function collectImageFiles(paths: string[]): string[] {
  const files: string[] = []
  for (const p of paths) {
    try {
      const stat = statSync(p)
      if (stat.isDirectory()) {
        collectFromDir(p, files)
      } else if (IMAGE_EXTS.has(extname(p).toLowerCase())) {
        files.push(p)
      }
    } catch {
      // skip
    }
  }
  return files
}

function collectFromDir(dir: string, out: string[]): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        collectFromDir(full, out)
      } else if (IMAGE_EXTS.has(extname(e.name).toLowerCase())) {
        out.push(full)
      }
    }
  } catch {
    // skip unreadable dirs
  }
}

interface RawPhotoRow {
  id: number
  model_id: number
  file_path: string
  sha256: string
  perceptual_hash: string
  width: number
  height: number
  file_size: number
  import_date: string
  original_ext: string
  converted_path: string | null
  thumbnail_path: string | null
}

function rowToPhoto(row: RawPhotoRow): Photo {
  return {
    id: row.id,
    modelId: row.model_id,
    filePath: row.file_path,
    sha256: row.sha256,
    perceptualHash: row.perceptual_hash,
    width: row.width,
    height: row.height,
    fileSize: row.file_size,
    importDate: row.import_date,
    originalExt: row.original_ext,
    convertedPath: row.converted_path,
    thumbnailPath: row.thumbnail_path,
    tags: [],
    collectionIds: [],
    platformStatuses: []
  }
}

function getSettings(): Record<string, string> {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
