import heicConvert from 'heic-convert'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'

const SUPPORTED_HEIC_EXTS = new Set(['.heic', '.heif', '.hif'])

export function isHeicFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return SUPPORTED_HEIC_EXTS.has(ext)
}

/** Decodes HEIC/HEIF to a JPEG (or PNG) buffer without touching the disk. */
export async function decodeHeic(
  inputPath: string,
  outputFormat: 'jpeg' | 'png' = 'jpeg'
): Promise<Buffer> {
  const buffer = readFileSync(inputPath)
  const output = await heicConvert({
    buffer: new Uint8Array(buffer),
    format: outputFormat === 'jpeg' ? 'JPEG' : 'PNG',
    quality: 0.92
  })
  return Buffer.from(output)
}

export function convertedDir(): string {
  const dir = join(app.getPath('userData'), 'converted')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Writes a full-size decoded copy next to the library. `uniqueKey` keeps two source
 * files that share a basename from overwriting each other.
 */
export function writeConverted(
  sourcePath: string,
  data: Buffer,
  outputFormat: 'jpeg' | 'png',
  uniqueKey: string | number
): string {
  const stem = basename(sourcePath, sourcePath.slice(sourcePath.lastIndexOf('.')))
  const outputPath = join(convertedDir(), `${uniqueKey}_${stem}.${outputFormat}`)
  writeFileSync(outputPath, data)
  return outputPath
}

export async function convertHeicToJpeg(
  inputPath: string,
  outputFormat: 'jpeg' | 'png' = 'jpeg',
  uniqueKey: string | number = Date.now()
): Promise<string> {
  const data = await decodeHeic(inputPath, outputFormat)
  return writeConverted(inputPath, data, outputFormat, uniqueKey)
}
