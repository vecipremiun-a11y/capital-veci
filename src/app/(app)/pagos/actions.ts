"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function markPaymentPaid(id: string, method = "Transferencia") {
  await requirePermission("edit_payments");
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment || payment.status === "PAID") return;
  await db.payment.update({
    where: { id },
    data: {
      status: "PAID",
      paidDate: new Date(),
      method,
      reference: `MAN-${Date.now().toString(36).toUpperCase()}`,
    },
  });
  await db.auditLog.create({
    data: {
      action: "PAY",
      entity: "Payment",
      entityId: id,
      detail: `Pago marcado como pagado por método ${method}`,
    },
  });
  revalidatePath("/pagos");
  revalidatePath(`/inversionistas/${payment.investorId}`);
}

export async function revertPaymentPaid(id: string) {
  await requirePermission("edit_payments");
  await db.payment.update({
    where: { id },
    data: { status: "PENDING", paidDate: null, method: null, reference: null },
  });
  revalidatePath("/pagos");
}
