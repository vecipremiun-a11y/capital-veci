"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const settingsSchema = z.object({
  companyName: z.string().min(2),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  reservePercentage: z.coerce.number().min(0).max(100),
  minLiquidity: z.coerce.number().min(0),
  maxCommitment: z.coerce.number().min(0).max(100),
  alertsEnabled: z.coerce.boolean().optional(),
});

export interface SettingsState {
  ok?: boolean;
  error?: string;
}

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requirePermission("settings");

  const parsed = settingsSchema.safeParse({
    companyName: formData.get("companyName"),
    legalName: formData.get("legalName") || undefined,
    taxId: formData.get("taxId") || undefined,
    reservePercentage: formData.get("reservePercentage"),
    minLiquidity: formData.get("minLiquidity"),
    maxCommitment: formData.get("maxCommitment"),
    alertsEnabled: formData.get("alertsEnabled") === "on",
  });
  if (!parsed.success) return { error: "Revisa los campos." };

  await db.companySettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  await db.auditLog.create({
    data: { action: "UPDATE", entity: "Settings", detail: "Configuración actualizada" },
  });

  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  revalidatePath("/liquidez");
  return { ok: true };
}
