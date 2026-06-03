"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requirePermission } from "@/lib/auth";
import { normalizeRut, validateRut } from "@/lib/format";

const investorSchema = z.object({
  fullName: z.string().min(3, "Nombre demasiado corto"),
  rut: z
    .string()
    .min(7, "RUT inválido")
    .refine(validateRut, "RUT inválido: revisa el dígito verificador"),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
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
  const rut = normalizeRut(data.rut);
  const existing = await db.investor.findUnique({ where: { rut } });
  if (existing) {
    return {
      error: "Ya existe un inversionista con ese RUT.",
      fieldErrors: { rut: "RUT ya registrado" },
    };
  }

  // Capital y rentabilidad arrancan en 0 y se derivan de los contratos
  // (ver recalcInvestorFinancials al firmar un contrato). Riesgo/estado
  // toman los defaults del esquema y se ajustan luego al editar.
  const investor = await db.investor.create({
    data: {
      fullName: data.fullName,
      rut,
      email: data.email || null,
      phone: data.phone || null,
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

// ---------------------------------------------------------
//  Editar inversionista (identidad + clasificación)
//  Capital y rentabilidad NO se editan aquí: son derivados de
//  los contratos (ver recalcInvestorFinancials).
// ---------------------------------------------------------
const updateInvestorSchema = z.object({
  fullName: z.string().min(3, "Nombre demasiado corto"),
  rut: z
    .string()
    .min(7, "RUT inválido")
    .refine(validateRut, "RUT inválido: revisa el dígito verificador"),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["ACTIVE", "FINISHED", "RISK", "BLOCKED"]),
});

export async function updateInvestor(
  id: string,
  _prev: InvestorFormState,
  formData: FormData,
): Promise<InvestorFormState> {
  await requirePermission("investors");

  const parsed = updateInvestorSchema.safeParse({
    fullName: formData.get("fullName"),
    rut: formData.get("rut"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    riskLevel: formData.get("riskLevel"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  const data = parsed.data;
  const rut = normalizeRut(data.rut);

  const existing = await db.investor.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Inversionista no encontrado." };
  }

  // El RUT debe seguir siendo único (permitiendo conservar el propio).
  const duplicate = await db.investor.findUnique({ where: { rut } });
  if (duplicate && duplicate.id !== id) {
    return {
      error: "Ya existe otro inversionista con ese RUT.",
      fieldErrors: { rut: "RUT ya registrado" },
    };
  }

  await db.investor.update({
    where: { id },
    data: {
      fullName: data.fullName,
      rut,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      riskLevel: data.riskLevel,
      status: data.status,
    },
  });

  await db.auditLog.create({
    data: {
      action: "UPDATE",
      entity: "Investor",
      entityId: id,
      detail: `Edición de inversionista ${data.fullName}`,
    },
  });

  revalidatePath("/inversionistas");
  revalidatePath(`/inversionistas/${id}`);
  redirect(`/inversionistas/${id}`);
}

// ---------------------------------------------------------
//  Crear acceso al portal para un inversionista existente
// ---------------------------------------------------------
const accessSchema = z.object({
  email: z.string().email("Correo inválido").max(120),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(120, "Máximo 120 caracteres"),
});

export interface AccessFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createInvestorAccess(
  investorId: string,
  _prev: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const session = await requirePermission("admin");

  const parsed = accessSchema.safeParse({
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const data = parsed.data;

  const investor = await db.investor.findUnique({
    where: { id: investorId },
    include: { user: true },
  });

  if (!investor) {
    return { error: "Inversionista no encontrado." };
  }
  if (investor.user) {
    return {
      error: "Este inversionista ya tiene cuenta de portal.",
    };
  }

  // Email único en User
  const emailTaken = await db.user.findUnique({ where: { email: data.email } });
  if (emailTaken) {
    return {
      error: "Ese correo ya está en uso por otro usuario.",
      fieldErrors: { email: "Correo duplicado" },
    };
  }

  const passwordHash = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      name: investor.fullName,
      email: data.email,
      passwordHash,
      role: "INVERSIONISTA",
      active: true,
      investorId: investor.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.sub,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Acceso al portal creado para ${investor.fullName}`,
    },
  });

  revalidatePath(`/inversionistas/${investorId}`);
  revalidatePath("/admin");
  return { ok: true };
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
