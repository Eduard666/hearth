# Hearth

Local-first photo library for content creators. Everything runs on your machine. No cloud, no account, no content leaves your device.

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
| Copied library files | `%APPDATA%\hearth\library\` |
| Thumbnails | `%APPDATA%\hearth\thumbnails\` |
| HEIC conversions | `%APPDATA%\hearth\converted\` |

## Database schema summary

- `photos` - core record: path, sha256, perceptual hash, dimensions, import date
- `tags` - free-form tags per photo
- `collections` - named groups of photos
- `collection_photos` - many-to-many join
- `models` - named subjects/people
- `model_photos` - many-to-many join
- `notes` - block-based notes, linked to a collection or model
- `platform_destinations` - Reddit, X, Fanvue, plus user-defined platforms
- `platform_statuses` - per-photo per-destination posted flag
- `app_settings` - key-value settings (import mode, theme, etc.)

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

1. Bump `version` in `package.json` (e.g. `1.0.1`).
2. Run `npm run dist` to build the new installer.
3. Create a GitHub Release at `https://github.com/Eduard666/hearth/releases/new`:
   - Tag: `v1.0.1`
   - Title: `Hearth v1.0.1`
   - Attach: `release/Hearth-1.0.1-Setup.exe` and the auto-generated `release/latest.yml`
4. Publish the release.

On next launch, existing installs will detect the new version, download it in the background, and show the "Relaunch to update" notification.

## App icon

Replace `resources/icon.png` with a 512x512 (or 1024x1024) PNG before distributing. electron-builder converts it to the formats Windows needs.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Import mode | copy | Copy files into userData library, or reference in place |
| Auto-convert HEIC | off | Automatically convert HEIC/HEIF to JPEG on import |
| HEIC output format | jpeg | JPEG or PNG |
| Theme | system | Light, dark, or follow OS |
| Near-duplicate threshold | 10 | Hamming distance (0-64). Lower = stricter. |
