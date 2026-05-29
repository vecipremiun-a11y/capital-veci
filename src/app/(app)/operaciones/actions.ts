"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

// =========================================================
//  Operaciones — Server Actions
//
//  Aquí vive la lógica financiera real del módulo. Cada acción
//  describe explícitamente cómo se mueve el dinero entre los
//  3 "compartimentos" del sistema:
//
//    1. LIQUIDEZ disponible      = totalCapital − capitalWorking − reservas
//    2. CAPITAL COMPROMETIDO     = Σ Operation.capitalUsed donde status ∈ {ACTIVE, PAUSED, RISK}
//    3. RESERVAS                 = totalCapital × reservePercentage
//
//  No tocamos directamente estos números: están DERIVADOS en
//  src/lib/data/metrics.ts. Por eso basta con crear/actualizar
//  el Operation y todo el dashboard reacciona automáticamente.
//
//  Adicionalmente, cada movimiento queda registrado en
//  CapitalMovement para auditoría y para construir el timeline
//  de la operación.
// =========================================================

// ---------- Schemas de validación ----------

const STATUSES = ["ACTIVE", "PAUSED", "RISK", "FINISHED", "LOSS"] as const;
const RISKS = ["LOW", "MEDIUM", "HIGH"] as const;
const CATEGORIES = [
  "MINIMARKET",
  "LOANS",
  "BARBERSHOP",
  "SOFTWARE",
  "CLEANING",
  "IMPORTS",
  "STOCK",
  "COMMERCIAL",
  "EXPANSION",
] as const;

const participantSchema = z.object({
  investorId: z.string().min(1),
  amount: z.number().positive("Aporte inválido"),
});

const createSchema = z.object({
  name: z.string().min(3, "Nombre muy corto").max(120),
  category: z.enum(CATEGORIES),
  description: z.string().optional().nullable(),
  business: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  capitalUsed: z.coerce.number().positive("El capital debe ser mayor a 0"),
  expectedReturn: z.coerce.number().min(0).max(500),
  durationMonths: z.coerce.number().int().min(1).max(120),
  startDate: z.string().min(8, "Fecha inicio requerida"),
  riskLevel: z.enum(RISKS),
  status: z.enum(["ACTIVE", "PAUSED", "RISK"]).default("ACTIVE"),
  // JSON con la lista de participantes inversionistas
  participants: z.string().optional().nullable(),
});

const finalizeSchema = z.object({
  returnAmount: z.coerce
    .number()
    .min(0, "El monto devuelto no puede ser negativo"),
  result: z.string().optional().nullable(),
});

const lossSchema = z.object({
  recovered: z.coerce
    .number()
    .min(0, "El recuperado no puede ser negativo"),
  result: z.string().optional().nullable(),
});

// ---------- Tipos del estado del formulario ----------

export interface OperationFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ---------- Helpers internos ----------

function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function parseParticipants(raw: string | null | undefined) {
  if (!raw) return [] as { investorId: string; amount: number }[];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p) => ({
        investorId: String(p.investorId ?? ""),
        amount: Number(p.amount ?? 0),
      }))
      .filter((p) => p.investorId && p.amount > 0);
  } catch {
    return [];
  }
}

// =========================================================
//  CREATE — Iniciar una nueva operación
//
//  EFECTO FINANCIERO:
//    • capitalUsed sale de la "liquidez disponible".
//    • Pasa a contar como "capital comprometido"
//      (porque metrics suma Operation.capitalUsed con status ∈ vivos).
//    • Se registra un CapitalMovement tipo COMMITTED para
//      que aparezca en el timeline y en /liquidez.
//    • Los participantes inversionistas quedan vinculados con
//      su aporte (Σ aportes ≤ capitalUsed; el resto es dinero
//      de la empresa).
// =========================================================
export async function createOperation(
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const session = await requirePermission("operations");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    business: formData.get("business"),
    responsibleId: formData.get("responsibleId") || null,
    capitalUsed: formData.get("capitalUsed"),
    expectedReturn: formData.get("expectedReturn"),
    durationMonths: formData.get("durationMonths"),
    startDate: formData.get("startDate"),
    riskLevel: formData.get("riskLevel"),
    status: formData.get("status") || "ACTIVE",
    participants: formData.get("participants"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const data = parsed.data;
  const participants = parseParticipants(data.participants);

  // Validar que la suma de aportes no exceda el capital de la operación
  const totalParticipants = participants.reduce((s, p) => s + p.amount, 0);
  if (totalParticipants > data.capitalUsed) {
    return {
      error: `La suma de aportes (${totalParticipants}) excede el capital de la operación (${data.capitalUsed}).`,
    };
  }

  // Código correlativo OP-####
  const count = await db.operation.count();
  const code = `OP-${String(1000 + count + 1)}`;

  const startDate = new Date(data.startDate);
  const endDate = addMonths(startDate, data.durationMonths);

  // Una sola transacción: operación + participantes + movimiento + log
  const operation = await db.$transaction(async (tx) => {
    const op = await tx.operation.create({
      data: {
        code,
        name: data.name,
        category: data.category,
        description: data.description || null,
        business: data.business || null,
        responsibleId: data.responsibleId || null,
        capitalUsed: data.capitalUsed,
        expectedReturn: data.expectedReturn,
        startDate,
        endDate,
        riskLevel: data.riskLevel,
        status: data.status,
      },
    });

    if (participants.length > 0) {
      await tx.operationParticipant.createMany({
        data: participants.map((p) => ({
          operationId: op.id,
          investorId: p.investorId,
          amount: p.amount,
        })),
      });
    }

    // 💸 Movimiento de capital: este es el "asiento contable" que
    // muestra que el dinero salió de liquidez y quedó comprometido.
    await tx.capitalMovement.create({
      data: {
        type: "COMMITTED",
        amount: data.capitalUsed,
        category: data.category,
        description: `Capital comprometido en ${op.name}`,
        operationId: op.id,
        date: startDate,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.sub,
        action: "CREATE",
        entity: "Operation",
        entityId: op.id,
        detail: `Operación ${code} (${op.name}) — capital ${data.capitalUsed}`,
      },
    });

    return op;
  });

  // Revalidación: dashboard, liquidez y operaciones reflejan el cambio
  revalidatePath("/operaciones");
  revalidatePath("/liquidez");
  revalidatePath("/dashboard");
  redirect(`/operaciones/${operation.id}`);
}

// =========================================================
//  FINALIZE — Cerrar una operación con resultado positivo
//
//  EFECTO FINANCIERO:
//    • returnAmount entra como movimiento RETURN.
//    • profit = returnAmount − capitalUsed.
//    • actualReturn (%) = profit / capitalUsed × 100.
//    • status pasa a FINISHED → deja de contar como comprometido
//      → la liquidez se "libera" automáticamente.
//    • Cada participante recibe su parte PRO RATA del retorno:
//        share = participant.amount / capitalUsed
//        returnAmount_i = returnAmount × share
//        profit_i       = returnAmount_i − participant.amount
//      (Si quedan diferencias por redondeo, van al "resto" de la
//      empresa, no a los inversionistas.)
// =========================================================
export async function finalizeOperation(
  id: string,
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const session = await requirePermission("operations");

  const parsed = finalizeSchema.safeParse({
    returnAmount: formData.get("returnAmount"),
    result: formData.get("result"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const op = await db.operation.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!op) return { error: "Operación no encontrada." };
  if (op.status === "FINISHED" || op.status === "LOSS") {
    return { error: "Esta operación ya fue cerrada." };
  }

  // Si returnAmount < capitalUsed, técnicamente es una pérdida parcial.
  // Aquí permitimos cerrarla como FINISHED igualmente, pero el profit
  // será negativo. Si quieres tratarla como LOSS, usa "Marcar pérdida".
  const returnAmount = parsed.data.returnAmount;
  const profit = returnAmount - op.capitalUsed;
  const actualReturn = op.capitalUsed > 0 ? (profit / op.capitalUsed) * 100 : 0;

  await db.$transaction(async (tx) => {
    // 1) Cierra la operación con los números reales
    await tx.operation.update({
      where: { id },
      data: {
        status: "FINISHED",
        returnAmount,
        profit,
        actualReturn,
        closedAt: new Date(),
        result: parsed.data.result ?? null,
      },
    });

    // 2) Reparte el retorno PRO RATA a los participantes
    for (const p of op.participants) {
      const share = op.capitalUsed > 0 ? p.amount / op.capitalUsed : 0;
      const partReturn = Math.round(returnAmount * share);
      await tx.operationParticipant.update({
        where: { id: p.id },
        data: {
          returnAmount: partReturn,
          profit: partReturn - p.amount,
        },
      });
    }

    // 3) 💰 Movimiento de capital: el dinero vuelve a liquidez
    await tx.capitalMovement.create({
      data: {
        type: "RETURN",
        amount: returnAmount,
        category: op.category,
        description: `Retorno de ${op.name} (utilidad ${profit >= 0 ? "+" : ""}${profit})`,
        operationId: op.id,
      },
    });

    // 4) Log de auditoría
    await tx.auditLog.create({
      data: {
        userId: session.sub,
        action: "CLOSE",
        entity: "Operation",
        entityId: op.id,
        detail: `Operación ${op.code} finalizada · retorno ${returnAmount} · utilidad ${profit}`,
      },
    });
  });

  revalidatePath(`/operaciones/${id}`);
  revalidatePath("/operaciones");
  revalidatePath("/liquidez");
  revalidatePath("/dashboard");
  return { ok: true };
}

// =========================================================
//  LOSS — Marcar pérdida (la operación falló)
//
//  EFECTO FINANCIERO:
//    • status pasa a LOSS → deja de contar como comprometido.
//    • recovered (lo que se logró recuperar, 0 ≤ recovered ≤ capitalUsed)
//      entra como movimiento RETURN si > 0.
//    • La diferencia (capitalUsed − recovered) se registra como
//      movimiento LOSS — es dinero que efectivamente desapareció.
//    • profit = recovered − capitalUsed (negativo).
//    • Se crea un Alert de nivel DANGER para que sea visible.
// =========================================================
export async function markOperationLoss(
  id: string,
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const session = await requirePermission("operations");

  const parsed = lossSchema.safeParse({
    recovered: formData.get("recovered"),
    result: formData.get("result"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Revisa los campos.", fieldErrors };
  }

  const op = await db.operation.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!op) return { error: "Operación no encontrada." };
  if (op.status === "FINISHED" || op.status === "LOSS") {
    return { error: "Esta operación ya fue cerrada." };
  }

  const recovered = Math.min(parsed.data.recovered, op.capitalUsed);
  const lost = op.capitalUsed - recovered;
  const profit = recovered - op.capitalUsed; // siempre ≤ 0

  await db.$transaction(async (tx) => {
    await tx.operation.update({
      where: { id },
      data: {
        status: "LOSS",
        returnAmount: recovered,
        profit,
        actualReturn:
          op.capitalUsed > 0 ? (profit / op.capitalUsed) * 100 : 0,
        closedAt: new Date(),
        result: parsed.data.result ?? null,
      },
    });

    // Reparte lo recuperado pro rata (los participantes también pierden)
    for (const p of op.participants) {
      const share = op.capitalUsed > 0 ? p.amount / op.capitalUsed : 0;
      const partRecovered = Math.round(recovered * share);
      await tx.operationParticipant.update({
        where: { id: p.id },
        data: {
          returnAmount: partRecovered,
          profit: partRecovered - p.amount,
        },
      });
    }

    if (recovered > 0) {
      await tx.capitalMovement.create({
        data: {
          type: "RETURN",
          amount: recovered,
          category: op.category,
          description: `Recuperación parcial de ${op.name}`,
          operationId: op.id,
        },
      });
    }
    if (lost > 0) {
      await tx.capitalMovement.create({
        data: {
          type: "LOSS",
          amount: lost,
          category: op.category,
          description: `Pérdida en ${op.name}`,
          operationId: op.id,
        },
      });
    }

    await tx.alert.create({
      data: {
        level: "DANGER",
        title: `Pérdida registrada en ${op.code}`,
        message: `La operación "${op.name}" se cerró con una pérdida de ${lost}. ${
          recovered > 0 ? `Recuperado: ${recovered}.` : "Sin recuperación."
        }`,
        category: "OPERATION",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.sub,
        action: "LOSS",
        entity: "Operation",
        entityId: op.id,
        detail: `Operación ${op.code} cerrada en pérdida · recuperado ${recovered} · perdido ${lost}`,
      },
    });
  });

  revalidatePath(`/operaciones/${id}`);
  revalidatePath("/operaciones");
  revalidatePath("/liquidez");
  revalidatePath("/dashboard");
  return { ok: true };
}

// =========================================================
//  SET STATUS — Cambios rápidos de estado sin cerrar
//
//  Solo permite transiciones entre estados "vivos":
//    ACTIVE ↔ PAUSED ↔ RISK
//
//  El capital sigue comprometido en todos estos casos (la
//  liquidez NO se libera). Esto es para reflejar la realidad:
//  pausar una operación no recupera el dinero ya invertido.
// =========================================================
export async function setOperationStatus(id: string, status: string) {
  const session = await requirePermission("operations");
  if (!["ACTIVE", "PAUSED", "RISK"].includes(status)) {
    throw new Error("Estado inválido para cambio rápido.");
  }
  const op = await db.operation.findUnique({ where: { id } });
  if (!op) return;
  if (op.status === "FINISHED" || op.status === "LOSS") {
    throw new Error("No se puede reabrir una operación cerrada.");
  }

  await db.operation.update({ where: { id }, data: { status } });
  await db.auditLog.create({
    data: {
      userId: session.sub,
      action: "STATUS_CHANGE",
      entity: "Operation",
      entityId: id,
      detail: `Operación ${op.code} → ${status}`,
    },
  });

  revalidatePath(`/operaciones/${id}`);
  revalidatePath("/operaciones");
  revalidatePath("/dashboard");
}
