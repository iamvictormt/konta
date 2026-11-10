import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDatabase = globalThis as typeof globalThis & { kontaDatabasePool?: Pool };

export const database = globalForDatabase.kontaDatabasePool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});

if (process.env.NODE_ENV !== "production") globalForDatabase.kontaDatabasePool = database;

database.on("error", () => {
  console.error("A ligação inativa ao PostgreSQL falhou.");
});

export type SqlRow = QueryResultRow;
export type SqlValue = string | number | boolean | null | string[];
export type SqlExecutor = Pick<PoolClient, "query">;

export async function queryAll<T extends QueryResultRow>(
  sql: string,
  parameters: SqlValue[] = [],
  executor: SqlExecutor = database,
) {
  const result = await executor.query<T>(sql, parameters);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  sql: string,
  parameters: SqlValue[] = [],
  executor: SqlExecutor = database,
) {
  const result = await executor.query<T>(sql, parameters);
  return result.rows[0];
}

export async function execute(
  sql: string,
  parameters: SqlValue[] = [],
  executor: SqlExecutor = database,
) {
  return executor.query(sql, parameters);
}

export async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const DEFAULT_ORGANIZATION_ID = "default";
