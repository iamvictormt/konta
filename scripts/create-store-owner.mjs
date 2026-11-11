import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;
const allowedFlags = new Set(["--email", "--password", "--name", "--force", "--yes", "-y"]);
const forwarded = [];
let organizationId = "";
const argumentsList = process.argv.slice(2);
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  const flag = argument.startsWith("--") ? argument.split("=", 1)[0] : argument;
  if (flag === "--organization-id") {
    organizationId = argument.includes("=") ? argument.slice(argument.indexOf("=") + 1) : argumentsList[++index] ?? "";
    continue;
  }
  if (flag.startsWith("-") && !allowedFlags.has(flag)) {
    throw new Error(`Opção não permitida para criar o administrador principal: ${flag}`);
  }
  forwarded.push(argument);
}

if (!organizationId || organizationId.length > 160) {
  throw new Error("Indique uma organização existente com --organization-id <id>.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
try {
  const organization = await pool.query("SELECT id FROM organizations WHERE id = $1", [organizationId]);
  if (!organization.rowCount) throw new Error(`A organização ${organizationId} não existe.`);
} finally {
  await pool.end();
}

const cliPath = resolve("node_modules/auth/dist/index.mjs");
const child = spawnSync(process.execPath, [
  cliPath,
  "create-admin",
  "--cwd",
  process.cwd(),
  "--config",
  "app/lib/server/auth.ts",
  "--role",
  "store-admin",
  "--data",
  JSON.stringify({
    organizationId,
    storeRole: "admin",
    isStoreOwner: true,
  }),
  ...forwarded,
], { stdio: "inherit", env: process.env });

if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
