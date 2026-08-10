import heicConvert from 'heic-convert'
import { readFileSync, writeFileSync } from 'fs'
import { join, basename, dirname } from 'path'
import { app } from 'electron'
import { mkdirSync } from 'fs'

const SUPPORTED_HEIC_EXTS = new Set(['.heic', '.heif', '.hif'])

export function isHeicFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return SUPPORTED_HEIC_EXTS.has(ext)
}

export async function convertHeicToJpeg(
  inputPath: string,
  outputFormat: 'jpeg' | 'png' = 'jpeg'
): Promise<string> {
  const buffer = readFileSync(inputPath)
  const outputBuffer = await heicConvert({
    buffer: new Uint8Array(buffer),
    format: outputFormat === 'jpeg' ? 'JPEG' : 'PNG',
    quality: 0.92
  })

  const convertedDir = join(app.getPath('userData'), 'converted')
  mkdirSync(convertedDir, { recursive: true })

  const baseName = basename(inputPath, inputPath.slice(inputPath.lastIndexOf('.')))
  const outputPath = join(convertedDir, `${baseName}.${outputFormat}`)
  writeFileSync(outputPath, Buffer.from(outputBuffer))
  return outputPath
}

export async function generateThumbnail(sourcePath: string): Promise<string> {
  const Jimp = (await import('jimp')).Jimp
  const thumbDir = join(app.getPath('userData'), 'thumbnails')
  mkdirSync(thumbDir, { recursive: true })

  const baseName = basename(sourcePath)
  const thumbPath = join(thumbDir, `thumb_${Date.now()}_${baseName}.jpg`)

  const image = await Jimp.read(sourcePath)
  image.resize({ w: 400, h: 400 })
  await image.write(thumbPath as `${string}.${string}`)
  return thumbPath
}
