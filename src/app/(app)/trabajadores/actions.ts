"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";

const assignmentSchema = z.object({
  userId: z.string().min(1, "Selecciona un trabajador"),
  type: z.enum(["ASSIGN", "RETURN"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  date: z.string().min(8, "Fecha requerida"),
  note: z.string().max(300).optional().nullable(),
});

export interface AssignmentFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Registra una entrega de capital a un trabajador (ASSIGN) o una devolución
 * suya a la empresa (RETURN).
 *
 * Es un movimiento de CUSTODIA: la plata sigue siendo del fondo, solo cambia
 * de manos. Por eso no genera CapitalMovement ni altera la liquidez global —
 * eso pasa recién cuando el trabajador coloca el efectivo en una operación.
 */
export async function recordAssignment(
  _prev: AssignmentFormState,
  formData: FormData,
): Promise<AssignmentFormState> {
  const session = await requirePermission("staff_capital");

  const parsed = assignmentSchema.safeParse({
    userId: formData.get("userId"),
    type: formData.get("type") || "ASSIGN",
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const data = parsed.data;

  const user = await db.user.findUnique({ where: { id: data.userId } });
  if (!user) return { error: "El trabajador no existe." };
  if (!(STAFF_ROLES as readonly string[]).includes(user.role)) {
    return { error: "Solo se puede asignar capital a usuarios del staff." };
  }

  // Fecha en hora local para que no se corra un día al guardarse en UTC.
  const date = new Date(`${data.date}T12:00:00`);

  await db.staffAssignment.create({
    data: {
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      note: data.note || null,
      date: Number.isNaN(date.getTime()) ? new Date() : date,
      authorId: session.sub,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.sub,
      action: data.type === "ASSIGN" ? "ASSIGN_CAPITAL" : "RETURN_CAPITAL",
      entity: "StaffAssignment",
      entityId: data.userId,
      detail:
        data.type === "ASSIGN"
          ? `Entrega de capital a ${user.name}`
          : `Devolución de capital de ${user.name}`,
    },
  });

  revalidatePath("/trabajadores");
  revalidatePath(`/trabajadores/${data.userId}`);
  revalidatePath("/mi-caja");
  return { ok: true };
}

/** Borra un movimiento de caja mal registrado. */
export async function deleteAssignment(id: string) {
  const session = await requirePermission("staff_capital");

  const assignment = await db.staffAssignment.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!assignment) return;

  await db.staffAssignment.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: session.sub,
      action: "DELETE",
      entity: "StaffAssignment",
      entityId: assignment.userId,
      detail: `Movimiento de caja eliminado (${assignment.user.name})`,
    },
  });

  revalidatePath("/trabajadores");
  revalidatePath(`/trabajadores/${assignment.userId}`);
  revalidatePath("/mi-caja");
}

/**
 * Asigna (o cambia) el trabajador responsable de una operación.
 *
 * Sirve para adoptar los préstamos antiguos que quedaron sin responsable:
 * hasta que tengan uno, su capital no aparece en la caja de nadie.
 */
export async function setOperationResponsible(formData: FormData) {
  const session = await requirePermission("staff_capital");

  const operationId = String(formData.get("operationId") || "");
  const rawUserId = String(formData.get("userId") || "");
  if (!operationId) return;

  const userId = rawUserId || null;
  const [operation, user] = await Promise.all([
    db.operation.findUnique({ where: { id: operationId } }),
    userId ? db.user.findUnique({ where: { id: userId } }) : null,
  ]);
  if (!operation) return;
  if (userId && !user) return;

  await db.operation.update({
    where: { id: operationId },
    data: { responsibleId: userId },
  });

  await db.auditLog.create({
    data: {
      userId: session.sub,
      action: "UPDATE",
      entity: "Operation",
      entityId: operationId,
      detail: user
        ? `${operation.code} asignada a ${user.name}`
        : `${operation.code} quedó sin responsable`,
    },
  });

  revalidatePath("/trabajadores");
  revalidatePath("/mi-caja");
  revalidatePath(`/operaciones/${operationId}`);
}
