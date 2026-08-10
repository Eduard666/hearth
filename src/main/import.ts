import { copyFileSync, mkdirSync, statSync, readdirSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { app } from 'electron'
import { getDb } from './db'
import { computeSha256, computePerceptualHash, hammingDistance } from './hash'
import { isHeicFile, convertHeicToJpeg, generateThumbnail } from './heic'
import type { ImportResult, Photo, DuplicateInfo, NearDuplicateInfo } from '../shared/types'
import Jimp from 'jimp'

const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.heic', '.heif', '.hif'
])

export async function importPhotos(
  paths: string[],
  options?: { autoConvertHeic?: boolean; heicOutputFormat?: 'jpeg' | 'png' }
): Promise<ImportResult> {
  const db = getDb()
  const settings = getSettings()
  const importMode = settings.importMode as 'copy' | 'reference'
  const autoConvert = options?.autoConvertHeic ?? settings.autoConvertHeic === 'true'
  const heicFormat = (options?.heicOutputFormat ?? settings.heicOutputFormat) as 'jpeg' | 'png'
  const threshold = parseInt(settings.nearDuplicateThreshold, 10)

  const allFiles = collectImageFiles(paths)
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    duplicates: [],
    nearDuplicates: [],
    heicFiles: []
  }

  const existingRows = db.prepare(
    'SELECT id, file_path, sha256, perceptual_hash, width, height, file_size, import_date, original_ext, converted_path, thumbnail_path FROM photos'
  ).all() as RawPhotoRow[]

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

      let processedPath = filePath
      let convertedPath: string | null = null

      if (heic && autoConvert) {
        convertedPath = await convertHeicToJpeg(filePath, heicFormat)
        processedPath = convertedPath
      }

      const phash = await computePerceptualHash(processedPath !== filePath ? processedPath : filePath)

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
        const copyDir = join(app.getPath('userData'), 'library')
        mkdirSync(copyDir, { recursive: true })
        const destPath = join(copyDir, basename(filePath))
        copyFileSync(filePath, destPath)
        storedPath = destPath
      }

      const stat = statSync(filePath)
      let width = 0
      let height = 0
      let thumbPath: string | null = null

      try {
        const imgSrc = convertedPath ?? (heic ? filePath : filePath)
        if (!heic || convertedPath) {
          const src = convertedPath ?? filePath
          const img = await Jimp.read(src)
          width = img.bitmap.width
          height = img.bitmap.height
          thumbPath = await generateThumbnail(src)
        }
      } catch {
        // dimensions unavailable - ok
      }

      const now = new Date().toISOString()
      const row = db.prepare(`
        INSERT INTO photos (file_path, sha256, perceptual_hash, width, height, file_size, import_date, original_ext, converted_path, thumbnail_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(storedPath, sha256, phash, width, height, stat.size, now, ext, convertedPath, thumbPath)

      existingRows.push({
        id: row.lastInsertRowid as number,
        file_path: storedPath,
        sha256,
        perceptual_hash: phash,
        width,
        height,
        file_size: stat.size,
        import_date: now,
        original_ext: ext,
        converted_path: convertedPath,
        thumbnail_path: thumbPath
      })

      result.imported++
    } catch (err) {
      console.error(`Import error for ${filePath}:`, err)
      result.skipped++
    }
  }

  return result
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
    modelIds: [],
    platformStatuses: []
  }
}

function getSettings(): Record<string, string> {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
