/**
 * Backfill (paso único): recalcula investedCapital y expectedReturn de TODOS
 * los inversionistas a partir de sus contratos firmados/activos (ACTIVE/SIGNED).
 *
 * Ejecutar con:  npm run db:backfill-investors
 *
 * ⚠️  Inversionistas creados a la antigua con capital escrito a mano pero SIN
 * contrato firmado pasarán a $0 (es lo correcto según el nuevo modelo: el
 * capital se deriva de los contratos). Si quieres conservar esos montos,
 * créales su contrato antes de correr esto.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

try {
  // @ts-ignore  — carga .env si está disponible (Node >= 20.12).
  process.loadEnvFile?.();
} catch {
  /* noop */
}

const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const adapter = new PrismaLibSQL({ url, authToken });
const db = new PrismaClient({ adapter });

const COMMITTED = ["ACTIVE", "SIGNED"];

async function main() {
  const investors = await db.investor.findMany({ select: { id: true, fullName: true } });
  console.log(`Recalculando ${investors.length} inversionistas…\n`);

  for (const inv of investors) {
    const contracts = await db.contract.findMany({
      where: { investorId: inv.id, status: { in: COMMITTED } },
      select: { amount: true, returnRate: true },
    });

    const investedCapital = contracts.reduce((s, c) => s + c.amount, 0);
    const expectedReturn =
      investedCapital > 0
        ? contracts.reduce((s, c) => s + c.amount * c.returnRate, 0) / investedCapital
        : 0;

    await db.investor.update({
      where: { id: inv.id },
      data: { investedCapital, expectedReturn },
    });

    console.log(
      `  ${inv.fullName}: ${contracts.length} contrato(s) → capital $${investedCapital.toLocaleString("es-CL")} · ${expectedReturn.toFixed(1)}%`,
    );
  }

  console.log("\n✓ Backfill completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
