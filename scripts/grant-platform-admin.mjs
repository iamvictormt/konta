import pg from "pg";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  throw new Error("Uso: npm run db:grant-platform-admin -- utilizador@dominio.com");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Defina DATABASE_URL antes de conceder o acesso.");

const pool = new pg.Pool({ connectionString, allowExitOnIdle: true });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      'SELECT id, role FROM "user" WHERE lower(email) = $1 AND banned IS NOT TRUE FOR UPDATE',
      [email],
    );
    const user = result.rows[0];
    if (!user) throw new Error("Não foi encontrada uma conta activa com esse e-mail.");

    const roles = new Set(String(user.role ?? "collaborator").split(",").filter(Boolean));
    roles.add("platform-admin");
    await client.query('UPDATE "user" SET role = $1 WHERE id = $2', [[...roles].join(","), user.id]);
    await client.query("COMMIT");
    console.log(`Acesso de administrador geral concedido a ${email}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
