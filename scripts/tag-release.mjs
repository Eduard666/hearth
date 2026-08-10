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

const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', ...opts }).trim()

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
