"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requirePermission } from "@/lib/auth";

// Solo roles staff — los inversionistas se crean desde /inversionistas/nuevo
// porque necesitan un registro Investor vinculado.
const STAFF_ROLES = ["ADMIN", "CONTADOR", "OPERADOR"] as const;

const userSchema = z.object({
  name: z
    .string()
    .min(2, "Nombre muy corto")
    .max(80, "Máximo 80 caracteres"),
  email: z
    .string()
    .email("Correo inválido")
    .max(120),
  role: z.enum(STAFF_ROLES),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(120, "Máximo 120 caracteres"),
});

export interface UserFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requirePermission("admin");

  const parsed = userSchema.safeParse({
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const data = parsed.data;

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return {
      error: "Ya existe un usuario con ese correo.",
      fieldErrors: { email: "Correo duplicado" },
    };
  }

  const passwordHash = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash,
      active: true,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.sub,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Usuario ${data.email} (${data.role}) creado`,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}
