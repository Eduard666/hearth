// Creates and pushes the git tag for the current package.json version.
//
// electron-builder publishes with releaseType "release", and GitHub rejects a published
// release whose tag does not exist yet (422 "Published releases must have a valid tag").
// Tagging first keeps `npm run release` a single command.
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tag = `v${version}`

// execFileSync returns null when stdout is not piped ('inherit' / 'ignore'), so the
// result has to be normalised before it can be treated as text.
const git = (args, opts = {}) => {
  const out = execFileSync('git', args, { cwd: root, encoding: 'utf8', ...opts })
  return typeof out === 'string' ? out.trim() : ''
}

const exists = (args) => {
  try {
    git(args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (exists(['rev-parse', '--verify', `refs/tags/${tag}`])) {
  console.log(`[tag-release] ${tag} already exists locally`)
} else {
  git(['tag', tag])
  console.log(`[tag-release] created ${tag}`)
}

const onRemote = git(['ls-remote', '--tags', 'origin', tag])
if (onRemote) {
  console.log(`[tag-release] ${tag} already on origin`)
} else {
  git(['push', 'origin', tag], { stdio: 'inherit' })
  console.log(`[tag-release] pushed ${tag} to origin`)
}

await ensureRelease()

/**
 * Creates the GitHub release before electron-builder runs.
 *
 * electron-builder publishes each artifact with its own publisher instance. When the
 * release does not exist yet they all race to create it - one wins and the losers fail,
 * taking their upload with them. That is how v1.1.0 and v1.3.0 ended up published with
 * only a blockmap and no installer.
 */
async function ensureRelease() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    console.warn('[tag-release] no GH_TOKEN set, leaving release creation to electron-builder')
    return
  }

  const config = readFileSync(join(root, 'electron-builder.yml'), 'utf8')
  const owner = config.match(/^\s*owner:\s*(\S+)/m)?.[1]
  const repo = config.match(/^\s*repo:\s*(\S+)/m)?.[1]
  if (!owner || !repo) {
    console.warn('[tag-release] could not read owner/repo from electron-builder.yml')
    return
  }

  const api = `https://api.github.com/repos/${owner}/${repo}/releases`
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hearth-release'
  }

  const existing = await fetch(`${api}/tags/${tag}`, { headers })
  if (existing.ok) {
    console.log(`[tag-release] release ${tag} already exists`)
    return
  }

  const created = await fetch(api, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tag_name: tag, name: version, draft: false, prerelease: false })
  })

  if (!created.ok) {
    throw new Error(`[tag-release] could not create release ${tag}: ${created.status} ${await created.text()}`)
  }
  console.log(`[tag-release] created release ${tag}`)
}
