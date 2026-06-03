import type { Prisma } from "@prisma/client";
import { CONTRACT_COMMITTED_STATUSES } from "@/lib/constants";

/**
 * Recalcula los campos financieros derivados de un inversionista a partir
 * de sus contratos firmados/activos (write-through denormalizado):
 *
 *   - investedCapital = suma de `amount` de contratos ACTIVE/SIGNED.
 *   - expectedReturn  = promedio de `returnRate` ponderado por monto.
 *
 * Estos campos NO se editan a mano: son un rollup mantenido automáticamente
 * cada vez que un contrato cambia de estado (ver signContract) y por el
 * script de backfill. Acepta un cliente de transacción para poder
 * encadenarse dentro de operaciones atómicas.
 */
export async function recalcInvestorFinancials(
  tx: Prisma.TransactionClient,
  investorId: string,
): Promise<void> {
  const contracts = await tx.contract.findMany({
    where: {
      investorId,
      status: { in: [...CONTRACT_COMMITTED_STATUSES] },
    },
    select: { amount: true, returnRate: true },
  });

  const investedCapital = contracts.reduce((s, c) => s + c.amount, 0);
  const expectedReturn =
    investedCapital > 0
      ? contracts.reduce((s, c) => s + c.amount * c.returnRate, 0) /
        investedCapital
      : 0;

  await tx.investor.update({
    where: { id: investorId },
    data: { investedCapital, expectedReturn },
  });
}
