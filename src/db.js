import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../blogs.sqlite');

const sqlite = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency and performance
sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business_name TEXT DEFAULT '',
    business_industry TEXT DEFAULT '',
    business_description TEXT DEFAULT '',
    frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly')) NOT NULL DEFAULT 'daily',
    preferred_time TEXT DEFAULT '09:00',
    tone TEXT DEFAULT 'Professional',
    language TEXT DEFAULT 'English',
    target_audience TEXT DEFAULT '',
    status TEXT CHECK(status IN ('active', 'paused')) DEFAULT 'active',
    last_run_at TEXT,
    next_run_at TEXT NOT NULL,
    total_posts INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blogs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    body TEXT NOT NULL,
    excerpt TEXT DEFAULT '',
    meta_title TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    keywords TEXT DEFAULT '[]',
    faq TEXT DEFAULT '[]',
    image_prompt TEXT NOT NULL,
    reading_time_minutes INTEGER DEFAULT 4,
    view_count INTEGER DEFAULT 0,
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS schedule_logs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL,
    blog_id TEXT,
    error_message TEXT,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_schedules_next ON schedules(next_run_at);
  CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
  CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published_at);
`);

export const db = {
  query(sql, params = []) {
    const stmt = sqlite.prepare(sql);
    return stmt.all(...params);
  },

  queryOne(sql, params = []) {
    const stmt = sqlite.prepare(sql);
    return stmt.get(...params) || null;
  },

  execute(sql, params = []) {
    const stmt = sqlite.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }
};
