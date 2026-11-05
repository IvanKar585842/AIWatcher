import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = 54329;
const user = "watchflowing";
const password = "watchflowing";
const database = "watchflowing";
const databaseDir = path.join(process.cwd(), "data", "postgres");
const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

function upsertEnv(file, values) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = current.split(/\r?\n/).filter((line) => line.length > 0);
  for (const [key, value] of Object.entries(values)) {
    const next = `${key}="${value}"`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = next;
    else lines.push(next);
  }
  writeFileSync(file, `${lines.join("\n")}\n`);
}

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

await mkdir(databaseDir, { recursive: true });
if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase(database);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/already exists/i.test(message)) throw error;
}

upsertEnv(path.join(process.cwd(), ".env"), {
  DATABASE_URL: url,
  DIRECT_URL: url,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
});

console.log(`postgres ready on 127.0.0.1:${port}`);

const migrate = spawn("npx prisma db push --skip-generate", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
});

const code = await new Promise((resolve) => migrate.on("exit", resolve));
if (code !== 0) {
  await pg.stop();
  process.exit(code ?? 1);
}

console.log("schema applied; postgres stays running");

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
