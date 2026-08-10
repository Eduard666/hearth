import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

let db: Database.Database
let dbPath: string

export function getDb(): Database.Database {
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'database')
  mkdirSync(dbDir, { recursive: true })

  dbPath = join(dbDir, 'hearth.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations()
}

/** Schema as it shipped originally; later shapes are reached through migrations. */
const BASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path     TEXT NOT NULL,
    sha256        TEXT NOT NULL,
    perceptual_hash TEXT NOT NULL,
    width         INTEGER NOT NULL,
    height        INTEGER NOT NULL,
    file_size     INTEGER NOT NULL,
    import_date   TEXT NOT NULL,
    original_ext  TEXT NOT NULL,
    converted_path TEXT,
    thumbnail_path TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_photos_import_date ON photos(import_date);

  CREATE TABLE IF NOT EXISTS tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id  INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    tag       TEXT NOT NULL,
    UNIQUE(photo_id, tag)
  );

  CREATE INDEX IF NOT EXISTS idx_tags_photo ON tags(photo_id);
  CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

  CREATE TABLE IF NOT EXISTS platform_destinations (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL UNIQUE,
    color  TEXT NOT NULL DEFAULT '#6366f1',
    icon   TEXT NOT NULL DEFAULT 'globe'
  );

  CREATE TABLE IF NOT EXISTS platform_statuses (
    photo_id       INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    destination_id INTEGER NOT NULL REFERENCES platform_destinations(id) ON DELETE CASCADE,
    posted         INTEGER NOT NULL DEFAULT 0,
    posted_at      TEXT,
    PRIMARY KEY (photo_id, destination_id)
  );

  CREATE TABLE IF NOT EXISTS collections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collection_photos (
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    photo_id      INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, photo_id)
  );

  CREATE TABLE IF NOT EXISTS models (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_photos (
    model_id  INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    photo_id  INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    PRIMARY KEY (model_id, photo_id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL DEFAULT '',
    content       TEXT NOT NULL DEFAULT '[]',
    collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    model_id      INTEGER REFERENCES models(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`

const LATEST_VERSION = 1

function runMigrations(): void {
  db.exec(BASE_SCHEMA)

  const version = db.pragma('user_version', { simple: true }) as number
  if (version >= LATEST_VERSION) {
    seedDefaults()
    return
  }

  if (version < 1) {
    backupDatabase(1)
    migrateToModelCentric()
  }

  db.pragma(`user_version = ${LATEST_VERSION}`)
  seedDefaults()
}

function seedDefaults(): void {
  seedDefaultSettings()
  seedDefaultDestinations()
}

/** Structural migrations rebuild tables, so keep a copy of what was there before. */
function backupDatabase(targetVersion: number): void {
  const photoCount = db.prepare('SELECT COUNT(*) AS c FROM photos').get() as { c: number }
  if (photoCount.c === 0) return

  try {
    const backupPath = `${dbPath}.pre-v${targetVersion}.bak`
    copyFileSync(dbPath, backupPath)
    console.log(`[db] backed up database to ${backupPath}`)
  } catch (err) {
    console.error('[db] backup failed:', err)
  }
}

/**
 * v1 - a photo belongs to exactly one model.
 *
 * Replaces the many-to-many model_photos join with a required photos.model_id, scopes
 * collections to a single model, and moves duplicate detection from library-wide to
 * per-model (the same file may legitimately live in two models' spaces).
 */
function migrateToModelCentric(): void {
  const hasModelId = tableColumns('photos').includes('model_id')
  if (hasModelId) return

  addColumn('models', 'last_opened_at', 'TEXT')
  addColumn('models', 'status', "TEXT NOT NULL DEFAULT 'active'")

  const fallbackModelId = resolveFallbackModel()

  db.exec('ALTER TABLE photos ADD COLUMN model_id INTEGER REFERENCES models(id) ON DELETE CASCADE')
  db.exec(`
    UPDATE photos SET model_id = (
      SELECT mp.model_id FROM model_photos mp WHERE mp.photo_id = photos.id ORDER BY mp.model_id LIMIT 1
    )
  `)
  if (fallbackModelId != null) {
    db.prepare('UPDATE photos SET model_id = ? WHERE model_id IS NULL').run(fallbackModelId)
  }

  // Table rebuilds must run with foreign keys off, per the SQLite ALTER TABLE procedure:
  // dropping the old table would otherwise cascade into tags, collections and statuses.
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      rebuildPhotosTable()
      rebuildCollectionsTable(fallbackModelId)
      db.exec('DROP TABLE IF EXISTS model_photos')
    })()

    const violations = db.pragma('foreign_key_check')
    if (Array.isArray(violations) && violations.length > 0) {
      console.error('[db] migration left foreign key violations:', violations)
    }
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

/**
 * Photos imported before models were required need an owner. A single existing model is
 * unambiguous; otherwise they land in "Unsorted" where they can be moved out.
 */
function resolveFallbackModel(): number | null {
  const photos = db.prepare('SELECT COUNT(*) AS c FROM photos').get() as { c: number }
  if (photos.c === 0) return null

  const models = db.prepare('SELECT id FROM models ORDER BY id').all() as { id: number }[]
  if (models.length === 1) return models[0].id

  const existing = db.prepare("SELECT id FROM models WHERE name = 'Unsorted'").get() as
    | { id: number }
    | undefined
  if (existing) return existing.id

  const result = db
    .prepare('INSERT INTO models (name, description, created_at) VALUES (?, ?, ?)')
    .run('Unsorted', 'Photos imported before Hearth required a model', new Date().toISOString())
  return result.lastInsertRowid as number
}

function rebuildPhotosTable(): void {
  db.exec(`
    CREATE TABLE photos_new (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id      INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      file_path     TEXT NOT NULL,
      sha256        TEXT NOT NULL,
      perceptual_hash TEXT NOT NULL,
      width         INTEGER NOT NULL,
      height        INTEGER NOT NULL,
      file_size     INTEGER NOT NULL,
      import_date   TEXT NOT NULL,
      original_ext  TEXT NOT NULL,
      converted_path TEXT,
      thumbnail_path TEXT
    );

    INSERT INTO photos_new (
      id, model_id, file_path, sha256, perceptual_hash, width, height,
      file_size, import_date, original_ext, converted_path, thumbnail_path
    )
    SELECT id, model_id, file_path, sha256, perceptual_hash, width, height,
           file_size, import_date, original_ext, converted_path, thumbnail_path
    FROM photos
    WHERE model_id IS NOT NULL;

    DROP TABLE photos;
    ALTER TABLE photos_new RENAME TO photos;

    CREATE UNIQUE INDEX idx_photos_model_sha256 ON photos(model_id, sha256);
    CREATE INDEX idx_photos_model ON photos(model_id);
    CREATE INDEX idx_photos_import_date ON photos(import_date);
    CREATE INDEX idx_photos_file_path ON photos(file_path);
  `)
}

function rebuildCollectionsTable(fallbackModelId: number | null): void {
  db.exec(`
    CREATE TABLE collections_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id    INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL,
      UNIQUE(model_id, name)
    );
  `)

  // A collection inherits the model of the photos it holds; empty ones fall back.
  db.prepare(`
    INSERT INTO collections_new (id, model_id, name, description, created_at)
    SELECT c.id,
           COALESCE(
             (SELECT p.model_id FROM collection_photos cp
              JOIN photos p ON p.id = cp.photo_id
              WHERE cp.collection_id = c.id LIMIT 1),
             ?
           ),
           c.name, c.description, c.created_at
    FROM collections c
    WHERE COALESCE(
            (SELECT p.model_id FROM collection_photos cp
             JOIN photos p ON p.id = cp.photo_id
             WHERE cp.collection_id = c.id LIMIT 1),
            ?
          ) IS NOT NULL
  `).run(fallbackModelId, fallbackModelId)

  db.exec(`
    DROP TABLE collections;
    ALTER TABLE collections_new RENAME TO collections;
    CREATE INDEX idx_collections_model ON collections(model_id);
  `)
}

function tableColumns(table: string): string[] {
  const rows = db.pragma(`table_info(${table})`) as { name: string }[]
  return rows.map((r) => r.name)
}

function addColumn(table: string, column: string, definition: string): void {
  if (tableColumns(table).includes(column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function seedDefaultSettings(): void {
  const defaults: Record<string, string> = {
    importMode: 'copy',
    autoConvertHeic: 'false',
    heicOutputFormat: 'jpeg',
    theme: 'system',
    nearDuplicateThreshold: '10',
    workspaceName: 'My agency'
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
  )
  const insertMany = db.transaction((entries: [string, string][]) => {
    for (const [k, v] of entries) insert.run(k, v)
  })
  insertMany(Object.entries(defaults))
}

function seedDefaultDestinations(): void {
  const defaults = [
    { name: 'Reddit', color: '#ff4500', icon: 'reddit' },
    { name: 'X', color: '#000000', icon: 'x' },
    { name: 'Fanvue', color: '#6d28d9', icon: 'fanvue' }
  ]
  const insert = db.prepare(
    'INSERT OR IGNORE INTO platform_destinations (name, color, icon) VALUES (?, ?, ?)'
  )
  for (const d of defaults) insert.run(d.name, d.color, d.icon)
}
