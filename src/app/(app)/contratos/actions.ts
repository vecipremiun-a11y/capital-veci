"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { buildSchedule, type PaymentFrequency } from "@/lib/payments";

const contractSchema = z.object({
  investorId: z.string().min(1, "Selecciona un inversionista"),
  amount: z.coerce.number().min(1, "Monto inválido"),
  durationMonths: z.coerce.number().int().min(1).max(120),
  returnRate: z.coerce.number().min(0).max(100),
  modality: z.enum(["FIXED", "VARIABLE", "PARTICIPATION"]),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "AT_MATURITY", "CUSTOM"]),
  customIntervalMonths: z
    .preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(1).max(120).optional()),
  periodicInterestPct: z
    .preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().min(0).max(100).optional()),
  conditions: z.string().optional(),
});

export interface ContractFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createContract(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  await requirePermission("generate_contracts");

  const parsed = contractSchema.safeParse({
    investorId: formData.get("investorId"),
    amount: formData.get("amount"),
    durationMonths: formData.get("durationMonths"),
    returnRate: formData.get("returnRate"),
    modality: formData.get("modality"),
    paymentFrequency: formData.get("paymentFrequency") || "MONTHLY",
    customIntervalMonths: formData.get("customIntervalMonths"),
    periodicInterestPct: formData.get("periodicInterestPct"),
    conditions: formData.get("conditions"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const data = parsed.data;
  // Para frecuencias no-CUSTOM ignoramos los campos personalizados (defaults seguros).
  const periodicPct =
    data.paymentFrequency === "AT_MATURITY"
      ? 0
      : data.paymentFrequency === "CUSTOM"
        ? (data.periodicInterestPct ?? 50)
        : 100;
  const customInterval =
    data.paymentFrequency === "CUSTOM"
      ? (data.customIntervalMonths ?? 1)
      : null;

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + data.durationMonths);

  const count = await db.contract.count();
  const code = `CTR-${String(2000 + count + 1)}`;

  const contract = await db.contract.create({
    data: {
      code,
      investorId: data.investorId,
      amount: data.amount,
      durationMonths: data.durationMonths,
      returnRate: data.returnRate,
      modality: data.modality,
      paymentFrequency: data.paymentFrequency,
      customIntervalMonths: customInterval,
      periodicInterestPct: periodicPct,
      startDate,
      endDate,
      status: "DRAFT",
      conditions:
        data.conditions ||
        "Capital destinado a operaciones comerciales privadas. Rentabilidad pagadera según la frecuencia pactada. Devolución del capital al término del plazo.",
    },
  });

  await db.auditLog.create({
    data: {
      action: "CREATE",
      entity: "Contract",
      entityId: contract.id,
      detail: `Contrato ${code} generado`,
    },
  });

  revalidatePath("/contratos");
  redirect(`/contratos/${contract.id}`);
}

/**
 * Firma digital: registra aceptación y genera el calendario de pagos
 * usando la MISMA función que el simulador (lib/payments.ts).
 */
export async function signContract(id: string, signatureName: string) {
  await requirePermission("generate_contracts");
  const contract = await db.contract.findUnique({ where: { id } });
  if (!contract || contract.status === "SIGNED") return;

  const schedule = buildSchedule({
    amount: contract.amount,
    annualRate: contract.returnRate,
    durationMonths: contract.durationMonths,
    frequency: contract.paymentFrequency as PaymentFrequency,
    customIntervalMonths: contract.customIntervalMonths ?? undefined,
    periodicInterestPct: contract.periodicInterestPct ?? undefined,
  });

  await db.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureName: signatureName.trim() || "Firma digital",
      },
    });

    const payments = schedule.payments.map((p) => {
      const dueDate = new Date(contract.startDate);
      dueDate.setMonth(dueDate.getMonth() + p.monthOffset);
      return {
        investorId: contract.investorId,
        contractId: contract.id,
        type: p.type,
        amount: p.amount,
        dueDate,
        status: "SCHEDULED",
      };
    });
    if (payments.length > 0) {
      await tx.payment.createMany({ data: payments });
    }

    await tx.auditLog.create({
      data: {
        action: "SIGN",
        entity: "Contract",
        entityId: id,
        detail: `Contrato ${contract.code} firmado · ${schedule.payments.length} cuotas generadas`,
      },
    });
  });

  revalidatePath(`/contratos/${id}`);
  revalidatePath("/contratos");
  revalidatePath("/pagos");
}
