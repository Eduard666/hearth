# Hearth - Work session plan

> **Status: all six items implemented.** See "What actually shipped" at the bottom for the
> parts where the diagnosis in this plan turned out to be wrong.


## 1. Window controls theme mismatch

The native minimize / maximize / close buttons (top-right) stay the wrong color when switching themes.
Electron's `titleBarOverlay` color is set once at window creation and is never updated when the user
toggles dark/light mode. Fix: listen for the `nativeTheme` `updated` event in the main process and
call `browserWindow.setTitleBarOverlay({ color, symbolColor })` with the correct values for the
current theme. The renderer already sends a theme-changed IPC or we can read `nativeTheme.shouldUseDarkColors`
directly. Both the background color and the symbol color need to change together.

---

## 2. Images do not render (238 gray rectangles)

The screenshot shows every photo card as an empty dark rectangle - thumbnails are not displaying.
Likely causes to investigate in order:

- Electron's Content Security Policy is blocking `file://` URLs in `<img src>`. The CSP header
  set in the main process may not allow `file://` origins for images. Fix: add
  `img-src 'self' file: data:` to the CSP, or use a custom protocol handler
  (`app.protocol.registerFileProtocol`) that serves thumbnails as `hearth://thumbnail/<id>` so
  they bypass the restriction.
- The thumbnail `.jpg` files were generated and stored in `userData/thumbnails/` but the path
  stored in the DB (the `thumbnailPath` column) uses an absolute Windows path that becomes invalid
  after re-installs or user renames the folder. Verify the stored path actually exists on disk.
- The `<img src>` in `PhotoCard.tsx` uses `file://` + the stored path. On Windows, the correct
  format is `file:///C:/...` (three slashes). Confirm the conversion is correct.

Quick diagnostic: open DevTools in the running app, inspect a photo card's `<img>` tag, copy its
`src`, paste into a browser address bar and check if the image loads.

---

## 3. Slow loading - need near-instant display

238 photos are all on the local disk yet loading is noticeably slow. Root causes and fixes:

**Why it is slow now:**
- On every filter change, the main process queries SQLite, returns all photo rows, and each card
  then tries to display a thumbnail synchronously.
- There is no virtual/windowed list - all 238 `<PhotoCard>` components mount at once.

**Fixes to implement:**
- **Virtual scrolling**: use `react-virtual` (TanStack Virtual) or `react-window` so only the
  ~30-40 cards visible in the viewport are mounted. This alone cuts render time from O(n) to O(1).
- **Thumbnail caching**: thumbnails already exist on disk. The delay is likely IPC round-trips +
  CSP blocking (see issue 2). Once the CSP/protocol fix is in place, thumbnails load from the
  local filesystem almost instantly.
- **Lazy thumbnail generation**: if a thumbnail does not exist yet for a photo, generate it on
  demand in a background worker rather than blocking the gallery render.
- **Pagination or cursor-based loading**: load the first 50 photos immediately, append more as
  the user scrolls. SQLite `LIMIT / OFFSET` or keyset pagination makes this trivial.

---

## 4. App philosophy - agency-first, everything per model

**Current problem:**
The app has a global "Library" that holds all photos from all models together, with models acting
as filters. For an agency this is backwards. No one thinks "give me all photos then filter by
model" - they think "open Jane's folder, work on Jane's photos."

**New mental model to implement:**
The app has no concept of a global library. A photo belongs to exactly one model. The workflow is:

1. Open a model (or create one).
2. Inside that model's space, import photos.
3. Everything - upload, tag, collection, platform status, notes - lives inside the model's space.

**Concrete changes needed:**

- **Remove the "Library" nav item** from the sidebar (or repurpose it as a dashboard / agency
  overview showing all models as cards, not a flat photo dump).
- **Import is always contextual**: the "Import photos" and "Import folder" buttons should only
  appear inside a model's space, not at the top of the sidebar. Clicking them imports directly
  into that model, not into a global pool.
- **Photo schema**: add a `NOT NULL` constraint on `model_id` in the `photos` table so a photo
  always belongs to a model. Migration required.
- **Sidebar becomes model-centric**: the sidebar lists models (and collections as sub-items of
  models). Clicking a model is the entry point to everything.
- **Collections are per-model**: a collection groups photos within one model's space, not across
  models. The `collections` table already has `model_id`... check if it does; if not, add it.
- **Default landing page**: when the app opens, if no models exist show an onboarding screen
  ("Create your first model to get started"). If models exist, open the most recently active one.

---

## 5. Funnel / navigation flow

Replace the current flat nav with a clear drill-down:

```
Sidebar (model list)
  -> Click a model
     -> Model space opens (Photos | Notes | Collections tabs)
        -> Inside Photos tab: Import button uploads to THIS model only
        -> Inside Collections tab: create/manage collections for this model
        -> Inside Notes tab: notes scoped to this model
```

The "funnel" means a user must choose a model before doing any work. There is no shortcut to a
global view. This prevents the accidental mix of photos across models.

---

## 6. Sidebar redesign direction

The current sidebar is cleaner than before but still feels generic. For an agency app:

- The sidebar header area should show the agency/workspace name (configurable in settings).
- Below that: a "Models" heading with a search/filter input when there are many models.
- Each model in the list shows: avatar circle + name + photo count + last-updated date.
- At the bottom: Settings only (no global Library, no global Notes).
- Consider adding model status badges (e.g., "Active", "Archived") so agencies can manage
  rosters without deleting data.

---

## Priority order for next session

1. Fix image rendering (without seeing photos, nothing else is testable).
2. Fix window controls theme mismatch (quick win, one function call).
3. Add virtual scrolling (makes the app usable with large libraries).
4. Rearchitect to model-centric import (biggest structural change, do last once the above work).

---

## What actually shipped

**1. Window controls** - the `nativeTheme` listener already existed, but the in-app theme
toggle never reached the main process, so it only worked when the OS theme changed. The
renderer now pushes its resolved theme over `window:setTitleBarTheme`.

**2. Images** - the CSP theory was wrong; there is no CSP header in this app. Two real causes:

- `generateThumbnail` called the Jimp **v1** API (`{ Jimp }`, `resize({w,h})`, `write()`)
  against the installed **jimp 0.22**. It threw on every import, was swallowed by a
  `try/catch`, and left `thumbnail_path` null for all 238 photos - zero thumbnails existed
  on disk.
- 196 of the 238 photos are HEIC, which Chromium cannot decode at all, and `file://` URLs
  are blocked anyway because the renderer is served over `http://` in dev.

Fixed by a privileged `hearth://` protocol (`src/main/media.ts`) that serves only files
under userData or recorded in the photos table, plus a rewritten thumbnail pipeline
(`src/main/thumbnails.ts`) using Electron's native `nativeImage` resize with a Jimp
fallback for webp/gif/bmp/tiff.

**3. Speed** - virtual scrolling via a hand-rolled `useVirtualGrid` (no new dependency;
cards are a fixed aspect so row height is derived from measured column width). 25 cards
mount instead of 238. Thumbnails are generated by a background pass that yields between
photos and streams each finished photo to the grid, with a progress bar.

**4-6. Model-centric** - schema v1 migration (`photos.model_id NOT NULL`, collections
scoped per model, `model_photos` dropped, duplicate detection moved from library-wide to
per-model). The migration backs the database up to `hearth.db.pre-v1.bak` first.
Sidebar is models-only with workspace name, search, status badges and archive/restore;
import lives in the model space header; onboarding shows when no model is open.

Escape hatch: "Move to model" in the gallery toolbar reassigns selected photos, since
existing photos had to be auto-assigned during migration.
