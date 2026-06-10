import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/http";
import {
  buildLoanSchedule as buildSchedule,
  inferFrequency,
  type LoanFrequency,
} from "@/lib/loans";
import {
  DEFAULT_COLLECT_WEEKDAYS,
  OPERATION_COMMITTED_STATUSES,
  CONTRACT_COMMITTED_STATUSES,
} from "@/lib/constants";

/**
 * Lógica de negocio de préstamos expuesta a la API (app externa).
 *
 * Replica EXACTAMENTE las reglas financieras de
 * src/app/(app)/operaciones/actions.ts para que la contabilidad del panel
 * (capital trabajando, liquidez, cobros) quede consistente sin importar si la
 * operación se crea desde la web o desde la app de préstamos.
 *
 * Un "préstamo" = Operation con category "LOANS" + sus LoanInstallment.
 */

// La frecuencia y el generador de calendario viven en @/lib/loans (client-safe)
// para que web, servidor y API usen exactamente la misma lógica.
export type { LoanFrequency };
const COMMITTED: string[] = [...OPERATION_COMMITTED_STATUSES];

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/**
 * Día-calendario "YYYY-MM-DD" de una fecha en una zona horaria dada.
 * Para "hoy" se usa "America/Santiago" (el corte es la medianoche chilena).
 * Para los dueDate (guardados como medianoche UTC) se usa "UTC", que es su día
 * calendario real. Comparar ambos strings da la igualdad de día correcta.
 */
function calendarDay(date: Date, timeZone: string): string {
  // en-CA produce el formato YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const FREQUENCY_LABEL: Record<LoanFrequency, string> = {
  DAILY: "Diario",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
};

// Como aún no hay columna de frecuencia (migración pendiente), se guarda
// como una etiqueta dentro de `description` y se lee de vuelta al responder.
const FREQ_TAG = /\[freq:(DAILY|WEEKLY|BIWEEKLY|MONTHLY)\]/i;

function readFrequencyTag(description: string | null): LoanFrequency | null {
  const m = description?.match(FREQ_TAG);
  return m ? (m[1].toUpperCase() as LoanFrequency) : null;
}

function composeDescription(
  desc: string | null | undefined,
  freq: LoanFrequency,
): string {
  const base = (desc ?? "").replace(FREQ_TAG, "").trim();
  return base ? `${base} [freq:${freq}]` : `[freq:${freq}]`;
}

function summarizeInstallments(
  installments: { amount: number; paidAmount: number; dueDate: Date; status: string }[],
  taggedFrequency?: LoanFrequency | null,
) {
  const total = installments.reduce((s, c) => s + c.amount, 0);
  const paid = installments.reduce((s, c) => s + c.paidAmount, 0);
  const paidCount = installments.filter((c) => c.status === "PAID").length;
  const frequency =
    taggedFrequency ?? inferFrequency(installments.map((c) => new Date(c.dueDate)));
  return {
    total,
    paid,
    outstanding: Math.max(total - paid, 0),
    installmentsCount: installments.length,
    paidCount,
    frequency,
    frequencyLabel: FREQUENCY_LABEL[frequency],
  };
}

// ---------- Lecturas ----------

export async function listLoans() {
  const ops = await db.operation.findMany({
    where: { category: "LOANS" },
    orderBy: { startDate: "desc" },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  return ops.map((op) => {
    const sum = summarizeInstallments(op.installments, readFrequencyTag(op.description));
    return {
      id: op.id,
      code: op.code,
      name: op.name,
      borrowerName: op.borrowerName,
      borrowerPhone: op.borrowerPhone,
      capital: op.capitalUsed,
      expectedReturn: op.expectedReturn,
      status: op.status,
      riskLevel: op.riskLevel,
      startDate: op.startDate,
      endDate: op.endDate,
      ...sum,
    };
  });
}

export async function getLoan(id: string) {
  const op = await db.operation.findUnique({
    where: { id },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      loanPayments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!op || op.category !== "LOANS") return null;
  const sum = summarizeInstallments(op.installments, readFrequencyTag(op.description));
  return {
    id: op.id,
    code: op.code,
    name: op.name,
    borrowerName: op.borrowerName,
    borrowerPhone: op.borrowerPhone,
    capital: op.capitalUsed,
    expectedReturn: op.expectedReturn,
    status: op.status,
    riskLevel: op.riskLevel,
    startDate: op.startDate,
    endDate: op.endDate,
    ...sum,
    installments: op.installments.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      dueDate: c.dueDate,
      amount: c.amount,
      paidAmount: c.paidAmount,
      remaining: Math.max(c.amount - c.paidAmount, 0),
      status: c.status,
      paidDate: c.paidDate,
    })),
    payments: op.loanPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      date: p.createdAt,
    })),
  };
}

export async function loanSummary() {
  const ops = await db.operation.findMany({
    where: { category: "LOANS" },
    include: { installments: true, loanPayments: true },
  });

  const active = ops.filter((o) => COMMITTED.includes(o.status));
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  // Métricas sobre TODAS las cuotas/cobros (según el contrato de la app).
  let outstanding = 0;
  let totalCollected = 0;
  let collectedThisMonth = 0;
  let overdueCount = 0;
  for (const op of ops) {
    for (const c of op.installments) {
      outstanding += Math.max(c.amount - c.paidAmount, 0);
      totalCollected += c.paidAmount;
      if (
        new Date(c.dueDate) < now &&
        (c.status === "PENDING" || c.status === "PARTIAL")
      )
        overdueCount++;
    }
    for (const p of op.loanPayments) {
      const d = new Date(p.createdAt);
      if (`${d.getFullYear()}-${d.getMonth()}` === monthKey)
        collectedThisMonth += p.amount;
    }
  }

  // "Hoy" en zona horaria de Chile (el corte es la medianoche chilena, no UTC).
  const todaySantiago = calendarDay(now, "America/Santiago");

  // Métricas sobre préstamos activos (capital comprometido y por venir).
  let lentCapital = 0;
  let totalToCollect = 0;
  type UpcomingItem = {
    operationId: string;
    borrowerName: string | null;
    sequence: number;
    dueDate: Date;
    remaining: number;
  };
  const upcoming: UpcomingItem[] = [];
  // Todas las cuotas que vencen HOY (Chile) y tienen saldo pendiente, de todos
  // los préstamos activos. No es "la próxima por préstamo": son TODAS las de hoy.
  const dueToday: UpcomingItem[] = [];
  for (const op of active) {
    lentCapital += op.capitalUsed;
    for (const c of op.installments) {
      totalToCollect += c.amount;
      const remaining = Math.max(c.amount - c.paidAmount, 0);
      if (remaining <= 0) continue; // ya pagada (PAID o sin saldo)
      const item: UpcomingItem = {
        operationId: op.id,
        borrowerName: op.borrowerName,
        sequence: c.sequence,
        dueDate: c.dueDate,
        remaining,
      };
      upcoming.push(item);
      // dueDate se guarda como medianoche UTC → su día calendario es el UTC.
      if (calendarDay(new Date(c.dueDate), "UTC") === todaySantiago) {
        dueToday.push(item);
      }
    }
  }

  upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  dueToday.sort((a, b) =>
    (a.borrowerName ?? "").localeCompare(b.borrowerName ?? "") || a.sequence - b.sequence,
  );

  const borrowers = new Set(
    active.map((o) => o.borrowerName || o.code).filter(Boolean),
  );

  return {
    outstanding, // total por cobrar
    lentCapital, // capital prestado
    estimatedProfit: Math.max(totalToCollect - lentCapital, 0), // ganancia estimada
    collectedThisMonth,
    totalCollected,
    clientsCount: borrowers.size,
    activeLoansCount: active.length,
    overdueCount,
    upcoming: upcoming.slice(0, 10),
    // Cobros de hoy (Chile): todas las cuotas que vencen hoy con saldo. Sin recorte.
    dueToday,
  };
}

// ---------- Escrituras ----------

export async function createLoan(
  input: {
    name: string;
    capital: number;
    returnPct: number;
    startDate: Date;
    term?: number;
    frequency: LoanFrequency;
    collectWeekdays?: number[];
    /** Monto fijo por cuota; si viene > 0, el N° de cuotas se deriva. */
    installmentAmount?: number;
    borrowerName?: string | null;
    borrowerPhone?: string | null;
    riskLevel?: "LOW" | "MEDIUM" | "HIGH";
    description?: string | null;
  },
  userId?: string,
) {
  const byAmount = (input.installmentAmount ?? 0) > 0;
  const schedule = buildSchedule({
    capital: input.capital,
    returnPct: input.returnPct,
    startDate: input.startDate,
    frequency: input.frequency,
    termDays: input.term ?? 0,
    collectWeekdays: input.collectWeekdays ?? [...DEFAULT_COLLECT_WEEKDAYS],
    mode: byAmount ? "DAILY_AMOUNT" : "TERM",
    dailyAmount: input.installmentAmount ?? 0,
  });
  if (schedule.installments.length === 0) {
    throw new Error("No se pudo generar el calendario de cuotas.");
  }
  if (schedule.installments.length > 365) {
    throw new Error("El monto por cuota es muy bajo: genera demasiadas cuotas.");
  }

  const count = await db.operation.count();
  const code = `OP-${String(1000 + count + 1)}`;
  const endDate = schedule.endDate ?? addMonths(input.startDate, 1);

  const op = await db.$transaction(async (tx) => {
    const created = await tx.operation.create({
      data: {
        code,
        name: input.name,
        category: "LOANS",
        // La frecuencia se guarda como etiqueta en description (sin columna propia aún).
        description: composeDescription(input.description, input.frequency),
        capitalUsed: input.capital,
        expectedReturn: input.returnPct,
        startDate: input.startDate,
        endDate,
        riskLevel: input.riskLevel ?? "MEDIUM",
        status: "ACTIVE",
        // Se modela como préstamo en cuotas para que aparezca en cobros del panel.
        isDailyLoan: true,
        dailyTermDays: schedule.installments.length,
        collectWeekdays:
          input.frequency === "DAILY"
            ? (input.collectWeekdays ?? [...DEFAULT_COLLECT_WEEKDAYS]).join(",")
            : null,
        borrowerName: input.borrowerName || null,
        borrowerPhone: input.borrowerPhone || null,
      },
    });

    await tx.loanInstallment.createMany({
      data: schedule.installments.map((c) => ({
        operationId: created.id,
        sequence: c.sequence,
        dueDate: c.dueDate,
        amount: c.amount,
        status: "PENDING",
      })),
    });

    // Asiento de tesorería: el capital sale de liquidez y queda comprometido.
    await tx.capitalMovement.create({
      data: {
        type: "COMMITTED",
        amount: input.capital,
        category: "LOANS",
        description: `Capital comprometido en ${created.name}`,
        operationId: created.id,
        date: input.startDate,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "CREATE",
        entity: "Operation",
        entityId: created.id,
        detail: `Préstamo ${code} (${created.name}) vía API — capital ${input.capital}`,
      },
    });

    return created;
  });

  return getLoan(op.id);
}

/**
 * Registra un abono sobre una cuota, con excedente en cascada a las
 * siguientes (misma lógica que collectInstallment de la web).
 */
export async function collectLoan(
  installmentId: string,
  rawAmount: number,
  method = "Efectivo",
  userId?: string,
): Promise<{ applied: number; leftover: number; installmentsTouched: number }> {
  const amount = Math.round(Number(rawAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Ingresa un monto mayor a 0.");
  }

  const target = await db.loanInstallment.findUnique({ where: { id: installmentId } });
  if (!target) throw new Error("Cuota no encontrada.");

  const all = await db.loanInstallment.findMany({
    where: { operationId: target.operationId },
    orderBy: { sequence: "asc" },
  });
  const startIdx = all.findIndex((c) => c.id === installmentId);
  if (startIdx < 0) throw new Error("Cuota no encontrada.");

  let left = amount;
  const updates: { id: string; paidAmount: number; status: string }[] = [];
  const allocations: { sequence: number; installmentId: string; amount: number }[] = [];
  for (let i = startIdx; i < all.length && left > 0; i++) {
    const c = all[i];
    const remaining = c.amount - c.paidAmount;
    if (remaining <= 0) continue;
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
    throw new Error("No hay saldo pendiente desde esta cuota en adelante.");
  }

  const appliedTotal = amount - left;
  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.loanInstallment.update({
        where: { id: u.id },
        data: { paidAmount: u.paidAmount, status: u.status, paidDate: now, method },
      });
    }
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
        userId: userId ?? null,
        action: "PAY",
        entity: "LoanInstallment",
        entityId: installmentId,
        detail: `Abono ${appliedTotal} (API) desde cuota #${target.sequence} · ${updates.length} cuota(s) · ${method}`,
      },
    });
  });

  return { applied: appliedTotal, leftover: left, installmentsTouched: updates.length };
}

/**
 * Revierte TODOS los abonos de una cuota (vuelve a PENDIENTE) y la descuenta de
 * los eventos de cobro (LoanPayment), borrando los que queden en cero. Misma
 * lógica que `revertInstallmentPaid` de la web. Devuelve el préstamo actualizado.
 */
export async function revertLoanInstallment(installmentId: string, userId?: string) {
  const inst = await db.loanInstallment.findUnique({ where: { id: installmentId } });
  if (!inst) throw new ApiError("Cuota no encontrada.", 404);

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
      if (!allocs.some((a) => a.installmentId === installmentId)) continue;
      const remaining = allocs.filter((a) => a.installmentId !== installmentId);
      const newAmount = remaining.reduce((s, a) => s + a.amount, 0);
      if (newAmount <= 0) {
        await tx.loanPayment.delete({ where: { id: ev.id } });
      } else {
        await tx.loanPayment.update({
          where: { id: ev.id },
          data: { amount: newAmount, allocations: JSON.stringify(remaining) },
        });
      }
    }
    await tx.loanInstallment.update({
      where: { id: installmentId },
      data: { status: "PENDING", paidAmount: 0, paidDate: null, method: null },
    });
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "REVERT",
        entity: "LoanInstallment",
        entityId: installmentId,
        detail: `Cuota #${inst.sequence} revertida (API)`,
      },
    });
  });

  return getLoan(inst.operationId);
}

/**
 * Edita un préstamo. Reglas (iguales que la web):
 *   • No se edita un préstamo cerrado (FINISHED/LOSS).
 *   • Si tiene cobros y se intentan cambiar campos financieros → 409 (hay que
 *     revertir los cobros primero). Sin campos financieros → solo metadata.
 *   • Sin cobros → regenera el calendario y corrige el asiento COMMITTED.
 * Body parcial: { name?, capital?, returnPct?, startDate?, frequency?,
 *   term? | installmentAmount?, collectWeekdays?, borrowerName?, borrowerPhone?,
 *   riskLevel?, description? }
 */
export async function updateLoan(
  id: string,
  body: Record<string, unknown>,
  userId?: string,
) {
  const op = await db.operation.findUnique({
    where: { id },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      loanPayments: { select: { id: true } },
    },
  });
  if (!op) throw new ApiError("Préstamo no encontrado.", 404);
  if (op.status === "FINISHED" || op.status === "LOSS") {
    throw new ApiError("No se puede editar un préstamo cerrado.", 409);
  }

  const hasCollections =
    op.installments.some((i) => i.paidAmount > 0) || op.loanPayments.length > 0;

  const present = (k: string) =>
    body[k] !== undefined && body[k] !== null && body[k] !== "";
  const financialKeys = [
    "capital",
    "returnPct",
    "startDate",
    "frequency",
    "term",
    "installmentAmount",
    "collectWeekdays",
  ];
  const wantsFinancial = financialKeys.some(present);
  if (hasCollections && wantsFinancial) {
    throw new ApiError(
      "El préstamo tiene cobros: revierte los cobros antes de cambiar monto, fechas o cuotas.",
      409,
    );
  }

  // -------- Metadata (siempre) --------
  const borrowerName =
    body.borrowerName !== undefined
      ? body.borrowerName
        ? String(body.borrowerName)
        : null
      : op.borrowerName;
  const borrowerPhone =
    body.borrowerPhone !== undefined
      ? body.borrowerPhone
        ? String(body.borrowerPhone)
        : null
      : op.borrowerPhone;
  const riskLevel =
    body.riskLevel && ["LOW", "MEDIUM", "HIGH"].includes(String(body.riskLevel))
      ? String(body.riskLevel)
      : op.riskLevel;
  const name = body.name
    ? String(body.name)
    : borrowerName
      ? `Préstamo a ${borrowerName}`
      : op.name;

  // -------- Solo metadata (hay cobros, o no se tocó nada financiero) --------
  if (!wantsFinancial) {
    const currentFreq =
      readFrequencyTag(op.description) ??
      inferFrequency(op.installments.map((i) => i.dueDate));
    const description =
      body.description !== undefined
        ? composeDescription(
            body.description ? String(body.description) : null,
            currentFreq,
          )
        : op.description;
    await db.$transaction(async (tx) => {
      await tx.operation.update({
        where: { id },
        data: { name, borrowerName, borrowerPhone, riskLevel, description },
      });
      await tx.auditLog.create({
        data: {
          userId: userId ?? null,
          action: "UPDATE",
          entity: "Operation",
          entityId: id,
          detail: `Préstamo ${op.code} editado (API, solo datos)`,
        },
      });
    });
    return getLoan(id);
  }

  // -------- Edición financiera (sin cobros): regenera el calendario --------
  const capital = present("capital") ? Number(body.capital) : op.capitalUsed;
  const returnPct = present("returnPct")
    ? Number(body.returnPct)
    : op.expectedReturn;
  const startDate = present("startDate")
    ? new Date(String(body.startDate))
    : op.startDate;
  const frequency = (
    present("frequency")
      ? String(body.frequency).toUpperCase()
      : (readFrequencyTag(op.description) ??
        inferFrequency(op.installments.map((i) => i.dueDate)))
  ) as LoanFrequency;
  const installmentAmount = present("installmentAmount")
    ? Number(body.installmentAmount)
    : undefined;
  const byAmount = (installmentAmount ?? 0) > 0;
  const term = present("term")
    ? Number(body.term)
    : byAmount
      ? 0
      : op.installments.length;
  const collectWeekdays = Array.isArray(body.collectWeekdays)
    ? (body.collectWeekdays as unknown[])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : op.collectWeekdays
      ? op.collectWeekdays
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : [...DEFAULT_COLLECT_WEEKDAYS];

  if (!Number.isFinite(capital) || capital <= 0)
    throw new ApiError("Capital inválido.", 400);
  if (!Number.isFinite(returnPct) || returnPct < 0)
    throw new ApiError("Retorno inválido.", 400);
  if (Number.isNaN(startDate.getTime()))
    throw new ApiError("Fecha de inicio inválida.", 400);
  if (!["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"].includes(frequency))
    throw new ApiError("Frecuencia inválida.", 400);

  const schedule = buildSchedule({
    capital,
    returnPct,
    startDate,
    frequency,
    termDays: term,
    collectWeekdays,
    mode: byAmount ? "DAILY_AMOUNT" : "TERM",
    dailyAmount: installmentAmount ?? 0,
  });
  if (schedule.installments.length === 0)
    throw new ApiError("No se pudo generar el calendario de cuotas.", 400);
  if (schedule.installments.length > 365)
    throw new ApiError(
      "El monto por cuota es muy bajo: genera demasiadas cuotas.",
      400,
    );

  const endDate = schedule.endDate ?? op.endDate ?? addMonths(startDate, 1);
  const description = composeDescription(
    body.description !== undefined
      ? body.description
        ? String(body.description)
        : null
      : op.description,
    frequency,
  );

  await db.$transaction(async (tx) => {
    await tx.operation.update({
      where: { id },
      data: {
        name,
        borrowerName,
        borrowerPhone,
        riskLevel,
        description,
        capitalUsed: capital,
        expectedReturn: returnPct,
        startDate,
        endDate,
        isDailyLoan: true,
        dailyTermDays: schedule.installments.length,
        collectWeekdays:
          frequency === "DAILY" ? collectWeekdays.join(",") : null,
      },
    });
    await tx.loanInstallment.deleteMany({ where: { operationId: id } });
    await tx.loanInstallment.createMany({
      data: schedule.installments.map((c) => ({
        operationId: id,
        sequence: c.sequence,
        dueDate: c.dueDate,
        amount: c.amount,
        status: "PENDING",
      })),
    });
    await tx.capitalMovement.updateMany({
      where: { operationId: id, type: "COMMITTED" },
      data: { amount: capital, date: startDate },
    });
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "UPDATE",
        entity: "Operation",
        entityId: id,
        detail: `Préstamo ${op.code} editado (API) — capital ${capital} · ${schedule.installments.length} cuota(s)`,
      },
    });
  });

  return getLoan(id);
}

/**
 * Elimina un préstamo creado por error. Solo si NO tiene cobros y NO está
 * cerrado. Borra el asiento COMMITTED (FK SetNull) y, por cascade, cuotas,
 * participantes y eventos de cobro. Misma regla que `deleteOperation` de la web.
 */
export async function deleteLoan(id: string, userId?: string) {
  const op = await db.operation.findUnique({
    where: { id },
    include: {
      installments: { select: { paidAmount: true } },
      loanPayments: { select: { id: true } },
    },
  });
  if (!op) throw new ApiError("Préstamo no encontrado.", 404);
  if (op.status === "FINISHED" || op.status === "LOSS") {
    throw new ApiError("No se puede eliminar un préstamo cerrado.", 409);
  }
  const hasCollections =
    op.installments.some((i) => i.paidAmount > 0) || op.loanPayments.length > 0;
  if (hasCollections) {
    throw new ApiError(
      "No se puede eliminar: tiene cobros registrados. Revierte los cobros primero.",
      409,
    );
  }

  await db.$transaction(async (tx) => {
    await tx.capitalMovement.deleteMany({ where: { operationId: id } });
    await tx.operation.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "DELETE",
        entity: "Operation",
        entityId: id,
        detail: `Préstamo ${op.code} (${op.name}) eliminado (API)`,
      },
    });
  });

  return { ok: true };
}

// ---------- Inversiones (lectura) ----------

export async function listInvestors() {
  const investors = await db.investor.findMany({
    orderBy: { investedCapital: "desc" },
    include: { _count: { select: { contracts: true } } },
  });
  return investors.map((i) => ({
    id: i.id,
    fullName: i.fullName,
    rut: i.rut,
    email: i.email,
    phone: i.phone,
    status: i.status,
    riskLevel: i.riskLevel,
    investedCapital: i.investedCapital,
    expectedReturn: i.expectedReturn,
    contractsCount: i._count.contracts,
  }));
}

export async function listContracts() {
  const contracts = await db.contract.findMany({
    orderBy: { createdAt: "desc" },
    include: { investor: { select: { fullName: true } } },
  });
  return contracts.map((c) => ({
    id: c.id,
    code: c.code,
    investorName: c.investor.fullName,
    amount: c.amount,
    returnRate: c.returnRate,
    modality: c.modality,
    paymentFrequency: c.paymentFrequency,
    durationMonths: c.durationMonths,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    committed: (CONTRACT_COMMITTED_STATUSES as readonly string[]).includes(c.status),
  }));
}
