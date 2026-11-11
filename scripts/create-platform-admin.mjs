import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const allowedFlags = new Set(["--email", "--password", "--name", "--force", "--yes", "-y"]);
const forwarded = process.argv.slice(2);
for (const argument of forwarded) {
  const flag = argument.startsWith("--") ? argument.split("=", 1)[0] : argument;
  if (flag.startsWith("-") && !allowedFlags.has(flag)) {
    throw new Error(`Opção não permitida para criar um administrador geral: ${flag}`);
  }
}

const child = spawnSync(process.execPath, [
  resolve("node_modules/auth/dist/index.mjs"),
  "create-admin",
  "--cwd",
  process.cwd(),
  "--config",
  "app/lib/server/auth.ts",
  "--role",
  "platform-admin",
  "--data",
  JSON.stringify({ isStoreOwner: false }),
  ...forwarded,
], { stdio: "inherit", env: process.env });

if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
