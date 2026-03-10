import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

function ensureColumn(db: AppDatabase, tableName: string, columnName: string, sqlType: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType};`);
}

export function createDatabase(databasePath: string): AppDatabase {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS config_sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      current_step INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      theme_json TEXT NOT NULL,
      visual_spec_json TEXT,
      visual_updated_at TEXT,
      latest_confidence REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      submitted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversation_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      step TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES config_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      display_text TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES config_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      template_type TEXT NOT NULL,
      rendered_content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES config_sessions(id) ON DELETE CASCADE
    );
  `);

  ensureColumn(db, "config_sessions", "visual_spec_json", "TEXT");
  ensureColumn(db, "config_sessions", "visual_updated_at", "TEXT");

  return db;
}
