"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().optional(),
);
const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().optional(),
);
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

const templateSchema = z.object({
  code: z
    .string()
    .min(2, "Código muy corto")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[A-Z0-9-]+$/, "Solo mayúsculas, números y guiones"),
  name: z.string().min(3, "Nombre muy corto").max(80),
  description: optionalString,
  modality: z.enum(["FIXED", "VARIABLE", "PARTICIPATION"]),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "AT_MATURITY", "CUSTOM"]),
  returnRate: optionalNumber.pipe(
    z.number().min(0).max(100).optional(),
  ),
  rateLabel: optionalString,
  durationMonths: optionalInt.pipe(
    z.number().int().min(1).max(120).optional(),
  ),
  durationLabel: optionalString,
});

export interface TemplateFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requirePermission("generate_contracts");

  const parsed = templateSchema.safeParse({
    code: String(formData.get("code") || "").toUpperCase().trim(),
    name: formData.get("name"),
    description: formData.get("description"),
    modality: formData.get("modality"),
    paymentFrequency: formData.get("paymentFrequency"),
    returnRate: formData.get("returnRate"),
    rateLabel: formData.get("rateLabel"),
    durationMonths: formData.get("durationMonths"),
    durationLabel: formData.get("durationLabel"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const data = parsed.data;

  // El código debe ser único
  const existing = await db.contractTemplate.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    return {
      error: "Ya existe una plantilla con ese código.",
      fieldErrors: { code: "Código duplicado" },
    };
  }

  await db.contractTemplate.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      modality: data.modality,
      paymentFrequency: data.paymentFrequency,
      returnRate: data.returnRate ?? null,
      rateLabel: data.rateLabel ?? null,
      durationMonths: data.durationMonths ?? null,
      durationLabel: data.durationLabel ?? null,
      isDefault: false,
    },
  });

  await db.auditLog.create({
    data: {
      action: "CREATE",
      entity: "ContractTemplate",
      entityId: data.code,
      detail: `Plantilla ${data.code} creada`,
    },
  });

  revalidatePath("/contratos/plantillas");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<void> {
  await requirePermission("generate_contracts");
  const tpl = await db.contractTemplate.findUnique({ where: { id } });
  if (!tpl) return;
  // No permitir borrar las plantillas por defecto del sistema
  if (tpl.isDefault) {
    throw new Error("No se puede eliminar una plantilla por defecto.");
  }
  await db.contractTemplate.delete({ where: { id } });
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entity: "ContractTemplate",
      entityId: tpl.code,
      detail: `Plantilla ${tpl.code} eliminada`,
    },
  });
  revalidatePath("/contratos/plantillas");
}
