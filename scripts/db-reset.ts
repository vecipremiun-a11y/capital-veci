/**
 * Reset de datos operativos — Capital Veci.
 *
 *   npx tsx scripts/db-reset.ts            -> solo reporta (dry run)
 *   npx tsx scripts/db-reset.ts --apply    -> ejecuta el borrado
 *
 * Conserva: los usuarios de KEEP_EMAILS, CompanySettings y ContractTemplate.
 * Borra: inversionistas, contratos, pagos, operaciones, cuotas, cobros,
 *        movimientos de capital, documentos, alertas, bitácora y el resto
 *        de usuarios.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

try {
  // @ts-ignore Node >= 20.12
  process.loadEnvFile?.();
} catch {
  /* noop */
}

const KEEP_EMAILS = ["admin@capitalveci.cl", "victor@capitalveci.cl"];
const APPLY = process.argv.includes("--apply");
const WIPE_TEMPLATES = process.argv.includes("--wipe-templates");

const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const db = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) });

async function counts() {
  const [
    users, investors, contracts, payments, operations, installments,
    loanPayments, participants, movements, documents, alerts, auditLogs,
    templates, settings,
  ] = await Promise.all([
    db.user.count(), db.investor.count(), db.contract.count(), db.payment.count(),
    db.operation.count(), db.loanInstallment.count(), db.loanPayment.count(),
    db.operationParticipant.count(), db.capitalMovement.count(), db.document.count(),
    db.alert.count(), db.auditLog.count(), db.contractTemplate.count(),
    db.companySettings.count(),
  ]);
  return {
    users, investors, contracts, payments, operations, installments,
    loanPayments, participants, movements, documents, alerts, auditLogs,
    templates, settings,
  };
}

async function main() {
  console.log(`Base de datos: ${url.startsWith("libsql") ? `TURSO -> ${url}` : url}`);
  console.log(`Modo: ${APPLY ? "APPLY (borrado real)" : "DRY RUN (solo lectura)"}\n`);

  const before = await counts();
  console.table(before);

  const allUsers = await db.user.findMany({ select: { email: true, name: true, role: true } });
  console.log("\nUsuarios actuales:");
  for (const u of allUsers) {
    const keep = KEEP_EMAILS.includes(u.email.toLowerCase());
    console.log(`  ${keep ? "CONSERVAR" : "BORRAR   "}  ${u.email}  (${u.name} · ${u.role})`);
  }

  if (!APPLY) {
    console.log("\nDry run: no se borró nada. Repetir con --apply para ejecutar.");
    return;
  }

  // Orden hijo -> padre para no depender del cascade del motor.
  await db.loanPayment.deleteMany();
  await db.loanInstallment.deleteMany();
  await db.operationParticipant.deleteMany();
  await db.capitalMovement.deleteMany();
  await db.document.deleteMany();
  await db.payment.deleteMany();
  await db.contract.deleteMany();
  await db.operation.deleteMany();
  // Desvincula usuarios conservados de cualquier inversionista antes de borrarlos.
  await db.user.updateMany({ where: { investorId: { not: null } }, data: { investorId: null } });
  await db.investor.deleteMany();
  await db.alert.deleteMany();
  await db.auditLog.deleteMany();
  await db.user.deleteMany({ where: { email: { notIn: KEEP_EMAILS } } });
  if (WIPE_TEMPLATES) await db.contractTemplate.deleteMany();

  console.log("\nBorrado completado. Estado final:");
  console.table(await counts());
  const rest = await db.user.findMany({ select: { email: true, name: true, role: true } });
  console.log("Usuarios conservados:", rest);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
