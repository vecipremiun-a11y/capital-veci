/**
 * Respaldo completo de la base a un JSON.
 *   npx tsx scripts/db-backup.ts [ruta-salida.json]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { writeFileSync } from "node:fs";

try {
  // @ts-ignore Node >= 20.12
  process.loadEnvFile?.();
} catch {
  /* noop */
}

const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const db = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) });

const out =
  process.argv[2] ||
  `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

async function main() {
  const dump = {
    _meta: { takenAt: new Date().toISOString(), source: url },
    users: await db.user.findMany(),
    investors: await db.investor.findMany(),
    contractTemplates: await db.contractTemplate.findMany(),
    contracts: await db.contract.findMany(),
    payments: await db.payment.findMany(),
    operations: await db.operation.findMany(),
    loanInstallments: await db.loanInstallment.findMany(),
    loanPayments: await db.loanPayment.findMany(),
    operationParticipants: await db.operationParticipant.findMany(),
    capitalMovements: await db.capitalMovement.findMany(),
    documents: await db.document.findMany(),
    alerts: await db.alert.findMany(),
    auditLogs: await db.auditLog.findMany(),
    companySettings: await db.companySettings.findMany(),
  };
  writeFileSync(out, JSON.stringify(dump, null, 2), "utf8");
  const n = Object.entries(dump)
    .filter(([k]) => k !== "_meta")
    .map(([k, v]) => `${k}=${(v as unknown[]).length}`)
    .join("  ");
  console.log(`Respaldo escrito en: ${out}`);
  console.log(n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
