/**
 * Seed / reset default admin in SQLite (data/app.sqlite).
 * Email: admin@scormcreator.local  Password: Admin@123
 *
 * Usage: node --experimental-strip-types scripts/seed-admin.mjs
 *    or: npx tsx scripts/seed-admin.mjs
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const email = "admin@scormcreator.local";
const password = "Admin@123";
const adminId = "00000000-0000-4000-8000-000000000001";

function sqlitePath() {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv);
  }
  const dataDir = process.env.DATA_DIR || "data";
  return path.resolve(process.cwd(), dataDir, "app.sqlite");
}

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const file = sqlitePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const admin = {
    id: adminId,
    email,
    name: "Admin",
    passwordHash: hash,
    googleId: null,
    createdAt: now,
    role: "admin",
    locked: false,
    planId: null,
  };

  db.prepare(
    `INSERT INTO docs (collection, id, data, updated_at)
     VALUES ('users', ?, ?, ?)
     ON CONFLICT(collection, id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at`,
  ).run(adminId, JSON.stringify(admin), now);

  // Also update by email if a different id already exists.
  const rows = db
    .prepare(`SELECT id, data FROM docs WHERE collection = 'users'`)
    .all() as { id: string; data: string }[];
  for (const row of rows) {
    const u = JSON.parse(row.data);
    if (
      String(u.email).toLowerCase() === email &&
      row.id !== adminId
    ) {
      u.passwordHash = hash;
      u.role = "admin";
      u.locked = false;
      db.prepare(
        `UPDATE docs SET data = ?, updated_at = ? WHERE collection = 'users' AND id = ?`,
      ).run(JSON.stringify(u), now, row.id);
    }
  }

  db.close();
  console.log("Admin ready in", file);
  console.log("  email:", email);
  console.log("  password:", password);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
