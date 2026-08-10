import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import imghash from 'imghash'

export async function computeSha256(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

export async function computePerceptualHash(filePath: string): Promise<string> {
  try {
    const hash = await imghash.hash(filePath, 16)
    return hash as string
  } catch {
    return '0'.repeat(64)
  }
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    const bitsA = parseInt(a[i], 16).toString(2).padStart(4, '0')
    const bitsB = parseInt(b[i], 16).toString(2).padStart(4, '0')
    for (let j = 0; j < 4; j++) {
      if (bitsA[j] !== bitsB[j]) dist++
    }
  }
  return dist
}
