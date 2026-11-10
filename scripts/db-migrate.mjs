import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Defina DATABASE_URL no ficheiro .env antes de executar as migrações.");
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = join(root, "db", "migrations");
const pool = new Pool({ connectionString: databaseUrl, allowExitOnIdle: true });

try {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS konta_schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        "SELECT version FROM konta_schema_migrations WHERE version = $1",
        [file],
      );
      if (existing.rowCount) continue;

      await client.query("BEGIN");
      try {
        const migration = await readFile(join(migrationsDirectory, file), "utf8");
        await client.query(migration);
        await client.query(
          "INSERT INTO konta_schema_migrations (version, applied_at) VALUES ($1, $2)",
          [file, new Date().toISOString()],
        );
        await client.query("COMMIT");
        console.log(`Migração aplicada: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    await client.query(
      `INSERT INTO organizations (id, name, currency_code, created_at)
       VALUES ($1, $2, 'Db', $3)
       ON CONFLICT (id) DO NOTHING`,
      ["default", process.env.KONTA_STORE_NAME ?? "Minha Loja", new Date().toISOString()],
    );
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
