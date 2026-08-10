# Hearth

Local-first photo library for content creators. Everything runs on your machine. No cloud, no account, no content leaves your device.

## How it is organised

Hearth is **model-centric**: a photo belongs to exactly one model, and there is no global
library. The workflow is always open a model → work inside its space (Photos, Collections,
Notes) → import into that model. Collections group photos within one model. **Tags** are
posting destinations shared across the whole workspace — name one per subreddit or
platform, and marking a photo posted records the date automatically.

See [AUDIT.md](AUDIT.md) for the change log and the reasoning behind these decisions.

## Tech stack

- Electron 43 + React 19 + TypeScript, bundled with electron-vite
- better-sqlite3 for local storage
- BlockNote for block-based notes
- dnd-kit for drag and drop
- heic-convert for HEIC/HEIF conversion (fully local)
- imghash for perceptual duplicate detection
- electron-updater + GitHub Releases for auto-updates

## Where data lives

| Item | Location |
|------|----------|
| Database | `%APPDATA%\hearth\database\hearth.db` |
| Pre-migration backups | `%APPDATA%\hearth\database\hearth.db.pre-v<n>.bak` |
| Copied library files | `%APPDATA%\hearth\library\model-<id>\` |
| Thumbnails | `%APPDATA%\hearth\thumbnails\` |
| HEIC conversions | `%APPDATA%\hearth\converted\` |

The app installs **per user** into `%LOCALAPPDATA%\Programs\Hearth`, which is what lets
updates apply without an admin prompt.

## Database schema summary

Schema version lives in `PRAGMA user_version` and is currently **2**. Migrations run on
launch from `src/main/db.ts` and back the database up before any structural change.

- `photos` - core record: `model_id` (NOT NULL), path, sha256, perceptual hash,
  dimensions, import date, thumbnail/converted paths
- `models` - the people whose spaces hold everything; has `status` and `last_opened_at`
- `collections` - named groups **scoped to one model** via `model_id`
- `collection_photos` - many-to-many join
- `tags` - user-created posting destinations, shared across the workspace
- `photo_posts` - one row per (photo, tag) with the date it was posted
- `notes` - block-based notes, scoped to a model
- `app_settings` - key-value settings (import mode, theme, workspace name, etc.)

Duplicate detection is **per model**: the same file may legitimately appear in two models'
spaces, so `photos` is unique on `(model_id, sha256)`.

## Development

```bash
# Install dependencies
npm install

# Start in dev mode (hot reload)
npm run dev
```

The app starts with hot reload via electron-vite. The main process restarts on changes to `src/main/`. The renderer hot-reloads in place.

## Build the Windows installer

```bash
npm run dist
```

This runs `electron-vite build` then `electron-builder --win`. The output is:

```
release/
  Hearth-1.0.0-Setup.exe
```

Requirements for building:
- Windows machine (or Wine on macOS/Linux)
- For native module support: Visual Studio Build Tools 2022 with "Desktop development with C++" workload. Run `npm run rebuild` after installing.
- The icon at `resources/icon.png` should be at least 256x256. Replace the placeholder before distributing.

## Publishing an update

1. Bump `version` in `package.json`. **This is mandatory** — republishing the same version
   produces a release that running apps ignore.
2. Commit and push.
3. Run:

```bash
GH_TOKEN=$(gh auth token) npm run release
```

That tags the commit, pushes the tag, creates the GitHub release, builds the installer and
uploads it along with `latest.yml`.

**Then verify the assets, not just that the release exists:**

```bash
gh release view v<version> --json assets
```

A release must carry three assets — the `.exe`, its `.blockmap`, and `latest.yml`. A
release missing `latest.yml` is invisible to the updater even though it looks published.
See the "Release pipeline" traps in [AUDIT.md](AUDIT.md) for why this has failed before.

Existing installs check on launch and every 6 hours, download in the background, then show
an update toast. Clicking the version in the title bar, or "Restart now" on the toast,
installs silently and relaunches — no installer wizard, no UAC prompt.

## App icon

Replace `resources/icon.png` with a 512x512 (or 1024x1024) PNG before distributing. electron-builder converts it to the formats Windows needs.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Workspace name | My agency | Shown at the top of the sidebar; click to rename |
| Import mode | copy | Copy files into userData library, or reference in place |
| Theme | system | Light, dark, or follow OS |
| Near-duplicate threshold | 10 | Hamming distance (0-64). Lower = stricter. |

`autoConvertHeic` and `heicOutputFormat` still exist in the settings table but no longer
do anything meaningful: HEIC is decoded by the background pass regardless, because
Chromium cannot display it at all.

## Thumbnails

Thumbnails and HEIC conversions are generated by a background pass that runs on launch and
after every import, one photo at a time, reporting progress to the gallery as each lands.
If previews ever look stale or missing, use **Rebuild previews** at the bottom of the
sidebar — it regenerates anything whose file is absent from disk.
