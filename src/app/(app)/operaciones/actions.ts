"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { buildDailyLoanSchedule } from "@/lib/loans";
import { DEFAULT_COLLECT_WEEKDAYS } from "@/lib/constants";

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
  // --- Cobro diario ---
  isDailyLoan: z.coerce.boolean().optional().default(false),
  dailyTermDays: z.coerce.number().int().min(1).max(365).optional(),
  // CSV de días que se cobra, ej "1,2,3,4,5,6"
  collectWeekdays: z.string().optional().nullable(),
  borrowerName: z.string().max(120).optional().nullable(),
  borrowerPhone: z.string().max(40).optional().nullable(),
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

/** Parsea un CSV de días de la semana ("1,2,3,4,5,6") a number[] válido (0–6). */
function parseWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [...DEFAULT_COLLECT_WEEKDAYS];
  const days = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length > 0 ? Array.from(new Set(days)) : [...DEFAULT_COLLECT_WEEKDAYS];
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
    isDailyLoan: formData.get("isDailyLoan") === "true",
    dailyTermDays: formData.get("dailyTermDays") || undefined,
    collectWeekdays: formData.get("collectWeekdays"),
    borrowerName: formData.get("borrowerName"),
    borrowerPhone: formData.get("borrowerPhone"),
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

  // --- Cobro diario: prepara el calendario de cuotas (si aplica) ---
  // El total a cobrar es plano: capital × (1 + retorno%/100), igual que el
  // preview del formulario. El dinero recaudado se registra como cobranza;
  // la liquidez se libera recién al finalizar la operación.
  const isDailyLoan = data.isDailyLoan === true;
  const collectWeekdays = parseWeekdays(data.collectWeekdays);
  const termDays = data.dailyTermDays ?? 0;
  const schedule =
    isDailyLoan && termDays > 0
      ? buildDailyLoanSchedule({
          capital: data.capitalUsed,
          returnPct: data.expectedReturn,
          startDate,
          termDays,
          collectWeekdays,
        })
      : null;

  if (isDailyLoan && (!schedule || schedule.installments.length === 0)) {
    return {
      error: "Para un préstamo con cobro diario indica un número de días válido.",
    };
  }

  // Una sola transacción: operación + participantes + movimiento + cuotas + log
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
        isDailyLoan,
        dailyTermDays: isDailyLoan ? termDays : null,
        collectWeekdays: isDailyLoan ? collectWeekdays.join(",") : null,
        borrowerName: isDailyLoan ? data.borrowerName || null : null,
        borrowerPhone: isDailyLoan ? data.borrowerPhone || null : null,
      },
    });

    // Calendario de cobro diario: una cuota por día hábil.
    if (schedule) {
      await tx.loanInstallment.createMany({
        data: schedule.installments.map((c) => ({
          operationId: op.id,
          sequence: c.sequence,
          dueDate: c.dueDate,
          amount: c.amount,
          status: "PENDING",
        })),
      });
    }

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

// =========================================================
//  COBRO DIARIO — Registrar abono(s) sobre una cuota
//
//  Es un registro de COBRANZA: cobrar NO mueve liquidez por sí
//  solo. El dinero se consolida al finalizar la operación con el
//  total efectivamente cobrado.
//
//  ABONOS PARCIALES + EXCEDENTE EN CASCADA:
//    • El monto cobrado se aplica primero a la cuota elegida
//      (hasta completar su saldo) y el excedente "se derrama" a
//      las cuotas siguientes por orden, una a una.
//    • Si el abono es menor al saldo, la cuota queda PARTIAL y
//      se puede seguir abonando otro día.
//    • Estado por cuota: PAID si paidAmount ≥ amount, PARTIAL si
//      0 < paidAmount < amount, PENDING si 0.
//
//  Devuelve cuánto se aplicó realmente y cuánto sobró (si el monto
//  excede el saldo total restante de la operación).
// =========================================================
export interface CollectResult {
  error?: string;
  applied?: number;
  leftover?: number;
  installmentsTouched?: number;
}

export async function collectInstallment(
  id: string,
  rawAmount: number,
  method = "Efectivo",
): Promise<CollectResult> {
  const session = await requirePermission("operations");

  const amount = Math.round(Number(rawAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Ingresa un monto mayor a 0." };
  }

  const target = await db.loanInstallment.findUnique({ where: { id } });
  if (!target) return { error: "Cuota no encontrada." };

  // Todas las cuotas de la operación, en orden, desde la cuota elegida.
  const all = await db.loanInstallment.findMany({
    where: { operationId: target.operationId },
    orderBy: { sequence: "asc" },
  });
  const startIdx = all.findIndex((c) => c.id === id);
  if (startIdx < 0) return { error: "Cuota no encontrada." };

  let left = amount;
  const updates: { id: string; paidAmount: number; status: string }[] = [];
  // Desglose del cobro: a qué cuotas y cuánto se aplicó (para el historial).
  const allocations: { sequence: number; installmentId: string; amount: number }[] =
    [];
  for (let i = startIdx; i < all.length && left > 0; i++) {
    const c = all[i];
    const remaining = c.amount - c.paidAmount;
    if (remaining <= 0) continue; // ya saldada, derrama a la siguiente
    const apply = Math.min(left, remaining);
    const newPaid = c.paidAmount + apply;
    updates.push({
      id: c.id,
      paidAmount: newPaid,
      status: newPaid >= c.amount ? "PAID" : "PARTIAL",
    });
    allocations.push({ sequence: c.sequence, installmentId: c.id, amount: apply });
    left -= apply;
  }

  if (updates.length === 0) {
    return { error: "No hay saldo pendiente desde esta cuota en adelante." };
  }

  const appliedTotal = amount - left;
  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.loanInstallment.update({
        where: { id: u.id },
        data: {
          paidAmount: u.paidAmount,
          status: u.status,
          paidDate: now,
          method,
        },
      });
    }
    // Registro del evento de cobro en el libro (historial con fecha + hora).
    await tx.loanPayment.create({
      data: {
        operationId: target.operationId,
        amount: appliedTotal,
        method,
        allocations: JSON.stringify(allocations),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: session.sub,
        action: "PAY",
        entity: "LoanInstallment",
        entityId: id,
        detail: `Abono ${appliedTotal} desde cuota #${target.sequence} · ${updates.length} cuota(s) afectada(s) · método ${method}`,
      },
    });
  });

  revalidatePath("/operaciones/cobros");
  revalidatePath(`/operaciones/${target.operationId}`);
  return {
    applied: amount - left,
    leftover: left,
    installmentsTouched: updates.length,
  };
}

export async function revertInstallmentPaid(id: string) {
  const session = await requirePermission("operations");
  const inst = await db.loanInstallment.findUnique({ where: { id } });
  if (!inst) return;

  // Para mantener el libro de cobros coherente, quitamos de cada evento la
  // parte que se había aplicado a ESTA cuota. Si un evento queda en cero, se
  // elimina; si no, se ajustan su monto y su desglose.
  const events = await db.loanPayment.findMany({
    where: { operationId: inst.operationId },
  });

  await db.$transaction(async (tx) => {
    for (const ev of events) {
      let allocs: { sequence: number; installmentId: string; amount: number }[];
      try {
        allocs = JSON.parse(ev.allocations);
      } catch {
        continue;
      }
      if (!allocs.some((a) => a.installmentId === id)) continue;
      const remainingAllocs = allocs.filter((a) => a.installmentId !== id);
      const newAmount = remainingAllocs.reduce((s, a) => s + a.amount, 0);
      if (newAmount <= 0) {
        await tx.loanPayment.delete({ where: { id: ev.id } });
      } else {
        await tx.loanPayment.update({
          where: { id: ev.id },
          data: {
            amount: newAmount,
            allocations: JSON.stringify(remainingAllocs),
          },
        });
      }
    }

    // Revierte TODOS los abonos de esta cuota (vuelve a pendiente).
    await tx.loanInstallment.update({
      where: { id },
      data: { status: "PENDING", paidAmount: 0, paidDate: null, method: null },
    });
    await tx.auditLog.create({
      data: {
        userId: session.sub,
        action: "REVERT",
        entity: "LoanInstallment",
        entityId: id,
        detail: `Cuota #${inst.sequence} revertida (abonos eliminados del historial)`,
      },
    });
  });

  revalidatePath("/operaciones/cobros");
  revalidatePath(`/operaciones/${inst.operationId}`);
}
