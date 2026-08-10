import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'database')
  mkdirSync(dbDir, { recursive: true })

  db = new Database(join(dbDir, 'hearth.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations()
}

function runMigrations(): void {
  db.exec(`
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_sha256 ON photos(sha256);
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
  `)

  seedDefaultSettings()
  seedDefaultDestinations()
}

function seedDefaultSettings(): void {
  const defaults: Record<string, string> = {
    importMode: 'copy',
    autoConvertHeic: 'false',
    heicOutputFormat: 'jpeg',
    theme: 'system',
    nearDuplicateThreshold: '10'
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
