# Engineering audit log

A record of substantial changes, the reasoning behind them, and the non-obvious traps
found along the way. Newest first.

---

## 2026-08-10 — Image rendering, model-centric rearchitecture, posting tags, auto-update

Shipped as **v1.1.0**, **v1.2.0** and **v1.3.0**. Schema moved from v0 to **v2**.

### 1. Photos never displayed (the "238 gray rectangles")

Three causes, none of which was the Content Security Policy originally suspected — this
app sets no CSP header at all.

- `generateThumbnail` called the **Jimp v1 API** (`{ Jimp }`, `resize({w,h})`, `write()`)
  against the installed **jimp 0.22**. It threw on every single import, the exception was
  swallowed by a `try/catch`, and `thumbnail_path` stayed null for all 238 photos. Zero
  thumbnails existed on disk.
- **196 of 238 photos were HEIC**, which Chromium cannot decode at all.
- `file://` URLs are blocked because the renderer is served over `http://` in dev.

**Fix:** a privileged `hearth://` protocol (`src/main/media.ts`) that serves only files
under `userData` or recorded in the `photos` table, plus a rewritten pipeline
(`src/main/thumbnails.ts`) built on Electron's native `nativeImage` resize with a Jimp
fallback for webp/gif/bmp/tiff. HEIC is decoded once into a full-size JPEG which is then
both the displayable copy and the thumbnail source.

> **Trap:** `src/main/heic.ts` and `src/main/import.ts` were written against *different*
> major versions of jimp. If jimp is ever upgraded, check both.

### 2. Performance

- **Virtual scrolling** via a hand-rolled `useVirtualGrid` — no new dependency. Cards are
  a fixed aspect (square thumbnail + fixed-height meta block), so row height derives from
  the measured column width without per-item measurement. ~25 cards mount instead of 238.
- **Background thumbnail pass** yields between photos and streams each finished photo to
  the renderer, so the grid paints immediately and fills in live.

> **Trap:** `CARD_META_HEIGHT` in `Gallery.tsx` must stay in sync with `.meta`'s height in
> `PhotoCard.module.css`, or rows drift out of alignment.

### 3. Model-centric rearchitecture (schema v1)

A photo now belongs to exactly one model; there is no global library. `photos.model_id`
is `NOT NULL`, collections are scoped per model, `model_photos` was dropped, and duplicate
detection moved from library-wide to per-model (the same file may legitimately live in two
models' spaces).

Existing photos were auto-assigned to the single existing model. **"Move to model" in the
gallery toolbar is the escape hatch** if that guess was ever wrong.

### 4. Posting tags (schema v2)

Tags are user-created posting destinations (a subreddit, a platform), **shared across the
whole workspace**. Marking a photo posted stamps the date automatically. Replaced three
overlapping ideas — free-form text tags, `platform_destinations`, `platform_statuses` —
with `tags` + `photo_posts`. None held real data, so nothing needed migrating.

- Right-click a photo (or a selection) to mark where it went; click again to un-mark.
- 3-dot menu on the card moves photos into a collection.
- Green check on any posted photo, tag and date on hover.

> **Trap:** the menus are rendered at gallery level, not inside cards. The grid is
> virtualized, so a menu living in a card is unmounted the moment its row scrolls away.

### 5. Auto-update

The updater was fully coded but **had never published a release**, so every check 404'd and
the error was swallowed into `console.error`. See "Release pipeline" below.

- Silent install: `quitAndInstall()` defaults to `isSilent = false`, so `NsisUpdater` omits
  `/S` and runs the installer interactively. Now `quitAndInstall(true, true)`.
- **Per-user install.** `oneClick: true` + `perMachine: false`. A per-machine install under
  Program Files needs admin rights, so every update would raise a UAC prompt even when
  silent.
- Version badge in the title bar doubles as the update control: installs a waiting update,
  otherwise checks for one.
- Re-checks every 6 hours rather than only at launch.

### 6. Native window button colours

The `titleBarOverlay` colours were hardcoded in the main process while the bar itself is
styled from `--sidebar-bg`. Two sources of truth for one visual element, so they drifted
(`#f9f9f9` vs `#f0f0f0` light, `#111111` vs `#161616` dark). The renderer now reads its own
computed `--sidebar-bg` / `--text-primary` and sends them over IPC — change the stylesheet
and the buttons follow.

---

## Traps worth remembering

### Migrations: the baseline schema resurrects dropped tables

`BASE_SCHEMA` ran `CREATE TABLE IF NOT EXISTS` on **every** launch, which cannot tell
"never existed" from "dropped on purpose". It kept re-creating `model_photos` after v1
removed it. The baseline now only runs on a genuinely fresh database
(`isFreshDatabase()`), and migrations own everything after that.

### Release pipeline

Four separate failure modes, all of which produced a release that *looked* fine:

1. **Draft by default.** electron-builder creates GitHub releases as drafts, and
   electron-updater cannot see drafts. Fixed with `releaseType: release`.
2. **Published releases need an existing tag.** GitHub returns
   `422 "Published releases must have a valid tag"` otherwise. `scripts/tag-release.mjs`
   creates and pushes the tag first.
3. **Publisher race.** electron-builder runs one publisher instance per artifact, and when
   the release does not exist they all race to create it — one wins, the losers fail and
   take their upload with them. This produced a v1.1.0 with only a blockmap, and **two
   v1.3.0 releases on one tag**, which breaks asset download URLs entirely even though the
   API reports the assets as present. `tag-release.mjs` now creates the release up front.
4. **GitHub CDN caches 404s.** After fixing a missing asset, the plain URL kept returning
   404 while `?cb=<random>` returned 200. It expires on its own in a few minutes.

> **Always verify the assets, not just that the release exists.** `gh release list` happily
> shows a tagged, "Latest"-badged release that is completely unusable.

### Verifying Electron work

Automated checks drive the **real built app** through playwright-core:

- Pass the **app directory**, not `out/main/index.js`. Pointing Electron at the entry file
  gives the app the default name "Electron" and therefore an empty `userData` profile —
  which silently tests against a blank library.
- Use `--user-data-dir=<temp>` with a copy of the real database to exercise migrations
  safely.
- **Native window chrome cannot be screenshotted.** The minimize/maximize/close buttons are
  drawn by the OS outside the web contents; verify them by spying on `setTitleBarOverlay`
  in the main process via `app.evaluate` instead.

### Electron 43 specifics

- `File.path` was removed in Electron 32+. Drag-and-drop paths must come from
  `webUtils.getPathForFile` via the preload.
- `protocol.registerSchemesAsPrivileged` must run **before** `app.whenReady()`.

---

## Known follow-ups

- The silent-update path is verified at the source and flag level, but a real
  1.2.0 → 1.3.0 hop is the only true end-to-end proof. Look for
  `Install: isSilent: true, isForceRunAfter: true` in the log.
- `autoConvertHeic` / `heicOutputFormat` settings are now largely vestigial — the
  background pass converts HEIC regardless.
- There is no UI for `importMode` (copy vs reference) or the near-duplicate threshold.
- Tag filtering exists in the `photos:get` query (`tagIds`, `postedOnly`) but has no UI yet.
