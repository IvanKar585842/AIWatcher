/**
 * Checks the database this environment points at for the agency schema.
 * Prints object names only. Does not print the connection string and does not
 * touch another database.
 *
 * Usage: npx tsx scripts/production-preflight.ts
 */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REQUIRED_TABLES = [
  "Workspace",
  "Client",
  "WorkspaceMember",
  "WorkspaceInvite",
  "SiteToken",
  "SiteSignal",
  "DomainVerification",
  "Team",
  "ApiKey",
];

const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "Monitor", column: "workspaceId" },
  { table: "Monitor", column: "clientId" },
  { table: "User", column: "webhookUrl" },
  { table: "User", column: "webhookSecret" },
  { table: "Workspace", column: "settings" },
];

const PRODUCTION_MIGRATIONS = [
  "20261108100000_product_access",
  "20261113160000_workspace_client",
  "20261113180000_workspace_membership",
  "20261114130000_site_sdk",
  "20261114140000_domain_verification",
];

function fail(name: string) {
  console.error("FAIL", name);
  process.exitCode = 1;
}

async function main() {
  for (const migration of PRODUCTION_MIGRATIONS) {
    const path = `prisma/migrations/${migration}/migration.sql`;
    if (existsSync(path)) console.log("PASS migration file", migration);
    else fail(`migration file ${migration}`);
  }

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `;
  const tableNames = new Set(tables.map((row) => row.table_name));
  for (const table of REQUIRED_TABLES) {
    if (tableNames.has(table)) console.log("PASS table", table);
    else fail(`table ${table}`);
  }

  const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Monitor', 'User', 'Workspace')
  `;
  const columnNames = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  for (const column of REQUIRED_COLUMNS) {
    const key = `${column.table}.${column.column}`;
    if (columnNames.has(key)) console.log("PASS column", key);
    else fail(`column ${key}`);
  }

  console.log("APPLY THESE ON PRODUCTION BEFORE DEPLOYING THIS CODE");
  for (const migration of PRODUCTION_MIGRATIONS) console.log("PENDING FOR OPERATOR", migration);
  console.log("This check used the database configured for this environment. It does not prove production.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "preflight failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
