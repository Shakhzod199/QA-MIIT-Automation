import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { hashPassword } from "@/lib/password";

// Reuse the same connection across dev hot-reloads / module re-evaluation,
// mirroring how ORM clients avoid exhausting connections in Next.js dev mode.
const globalForDb = globalThis as unknown as { __qaDb?: Database.Database };

function createDb(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
  `);

  seedFirstAdmin(db);
  return db;
}

// Preserves the pre-existing single-login deployments: the first ever boot
// (empty users table) promotes the old shared DASHBOARD_USERNAME/PASSWORD
// into a real admin account so nobody gets locked out by this migration.
function seedFirstAdmin(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
  if (count.n > 0) return;

  const username = process.env.DASHBOARD_USERNAME ?? "admin";
  const password = process.env.DASHBOARD_PASSWORD ?? "admin";
  db.prepare(
    "INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)"
  ).run(username, null, hashPassword(password), new Date().toISOString());
}

export function getDb(): Database.Database {
  if (!globalForDb.__qaDb) {
    globalForDb.__qaDb = createDb();
  }
  return globalForDb.__qaDb;
}
