const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const databaseUrl = process.env.DATABASE_URL || "/app/data/dispatch.db";
const migrationsDir = "/app/drizzle";
const journalPath = path.join(migrationsDir, "meta", "_journal.json");
const appTableNames = ["user", "task", "project", "note", "dispatch"];

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!fileExists(databaseUrl)) {
  console.log(`[dispatch] No database found at ${databaseUrl}; skipping migration repair.`);
  process.exit(0);
}

if (!fileExists(journalPath)) {
  console.log(`[dispatch] No migration journal found at ${journalPath}; skipping migration repair.`);
  process.exit(0);
}

const db = new Database(databaseUrl);

try {
  const migrationTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();

  if (!migrationTableExists) {
    console.log("[dispatch] Migration table not found; skipping migration repair.");
    process.exit(0);
  }

  const migrationCount = db.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get().count;
  if (migrationCount > 0) {
    console.log(`[dispatch] Migration history already populated (${migrationCount}); no repair needed.`);
    process.exit(0);
  }

  const placeholders = appTableNames.map(() => "?").join(", ");
  const appTableCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
    )
    .get(...appTableNames).count;

  if (appTableCount === 0) {
    console.log("[dispatch] No existing app tables found; no migration repair needed.");
    process.exit(0);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    console.log("[dispatch] Migration journal has no entries; no repair needed.");
    process.exit(0);
  }

  const insertMigration = db.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)");
  const applyRepair = db.transaction(() => {
    for (const entry of journal.entries) {
      const migrationPath = path.join(migrationsDir, `${entry.tag}.sql`);
      if (!fileExists(migrationPath)) {
        throw new Error(`Missing migration file: ${migrationPath}`);
      }

      const migrationSql = fs.readFileSync(migrationPath, "utf8");
      const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");
      insertMigration.run(hash, entry.when);
    }
  });

  applyRepair();
  console.log(`[dispatch] Repaired migration history with ${journal.entries.length} entries.`);
} finally {
  db.close();
}
