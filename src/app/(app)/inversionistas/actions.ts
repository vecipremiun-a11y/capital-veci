"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const investorSchema = z.object({
  fullName: z.string().min(3, "Nombre demasiado corto"),
  rut: z.string().min(7, "RUT inválido"),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  investedCapital: z.coerce.number().min(0),
  expectedReturn: z.coerce.number().min(0).max(100),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["ACTIVE", "FINISHED", "RISK", "BLOCKED"]),
  notes: z.string().optional(),
});

export interface InvestorFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createInvestor(
  _prev: InvestorFormState,
  formData: FormData,
): Promise<InvestorFormState> {
  await requirePermission("investors");

  const parsed = investorSchema.safeParse({
    fullName: formData.get("fullName"),
    rut: formData.get("rut"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    investedCapital: formData.get("investedCapital"),
    expectedReturn: formData.get("expectedReturn"),
    riskLevel: formData.get("riskLevel"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  const data = parsed.data;
  const existing = await db.investor.findUnique({ where: { rut: data.rut } });
  if (existing) {
    return {
      error: "Ya existe un inversionista con ese RUT.",
      fieldErrors: { rut: "RUT ya registrado" },
    };
  }

  const investor = await db.investor.create({
    data: {
      fullName: data.fullName,
      rut: data.rut,
      email: data.email || null,
      phone: data.phone || null,
      investedCapital: data.investedCapital,
      expectedReturn: data.expectedReturn,
      riskLevel: data.riskLevel,
      status: data.status,
      notes: data.notes || null,
    },
  });

  await db.auditLog.create({
    data: {
      action: "CREATE",
      entity: "Investor",
      entityId: investor.id,
      detail: `Alta de inversionista ${investor.fullName}`,
    },
  });

  revalidatePath("/inversionistas");
  redirect(`/inversionistas/${investor.id}`);
}

export async function toggleInvestorBlock(id: string) {
  await requirePermission("investors");
  const inv = await db.investor.findUnique({ where: { id } });
  if (!inv) return;
  const next = inv.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
  await db.investor.update({ where: { id }, data: { status: next } });
  await db.auditLog.create({
    data: {
      action: next === "BLOCKED" ? "BLOCK" : "UNBLOCK",
      entity: "Investor",
      entityId: id,
    },
  });
  revalidatePath("/inversionistas");
  revalidatePath(`/inversionistas/${id}`);
}
