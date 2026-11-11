import { Pool } from "pg";

if (process.env.NODE_ENV === "production") {
  throw new Error("A loja padrão é apenas para desenvolvimento; crie lojas pelo administrador da plataforma.");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Defina DATABASE_URL antes de criar a loja local.");

const pool = new Pool({ connectionString: databaseUrl, allowExitOnIdle: true });
try {
  await pool.query(
    `INSERT INTO organizations (id, name, currency_code, created_at, status, enabled_modules)
     VALUES ('default', $1, 'Db', $2, 'active', ARRAY['commerce']::TEXT[])
     ON CONFLICT (id) DO NOTHING`,
    [process.env.KONTA_STORE_NAME ?? "Minha Loja", new Date().toISOString()],
  );
  console.log("Loja local de desenvolvimento pronta.");
} finally {
  await pool.end();
}
