import "server-only";
import { db } from "@/lib/db";
import { buildDailyLoanSchedule } from "@/lib/loans";
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

export type LoanFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
const COMMITTED: string[] = [...OPERATION_COMMITTED_STATUSES];

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

interface ScheduleItem {
  sequence: number;
  dueDate: Date;
  amount: number;
}

/**
 * Genera el calendario de cuotas según la frecuencia.
 *   total a cobrar = round(capital × (1 + retorno%/100))   (interés plano)
 *   cuota          = floor(total / term); la última absorbe el redondeo.
 * DAILY usa la lógica por días hábiles (buildDailyLoanSchedule). Las demás
 * frecuencias colocan una cuota cada 7 / 14 días o cada mes, empezando un
 * período después de la fecha de inicio.
 */
export function buildLoanSchedule(input: {
  capital: number;
  returnPct: number;
  startDate: Date;
  term: number;
  frequency: LoanFrequency;
  collectWeekdays?: number[];
}): { total: number; installments: ScheduleItem[]; endDate: Date | null } {
  const capital = Math.max(input.capital, 0);
  const returnPct = Math.max(input.returnPct, 0);
  const term = Math.max(Math.round(input.term), 1);

  if (input.frequency === "DAILY") {
    const s = buildDailyLoanSchedule({
      capital,
      returnPct,
      startDate: input.startDate,
      termDays: term,
      collectWeekdays: input.collectWeekdays ?? [...DEFAULT_COLLECT_WEEKDAYS],
    });
    return { total: s.total, installments: s.installments, endDate: s.endDate };
  }

  const total = Math.round(capital * (1 + returnPct / 100));
  const base = Math.floor(total / term);
  const stepDays = input.frequency === "WEEKLY" ? 7 : input.frequency === "BIWEEKLY" ? 15 : 0;

  const installments: ScheduleItem[] = [];
  for (let k = 1; k <= term; k++) {
    const dueDate =
      input.frequency === "MONTHLY"
        ? addMonths(input.startDate, k)
        : addDays(input.startDate, stepDays * k);
    const amount = k === term ? total - base * (term - 1) : base;
    installments.push({ sequence: k, dueDate, amount });
  }

  return {
    total,
    installments,
    endDate: installments[installments.length - 1]?.dueDate ?? null,
  };
}

/** Infiere la frecuencia mirando la separación entre las dos primeras cuotas. */
function inferFrequency(dates: Date[]): LoanFrequency {
  if (dates.length < 2) return "MONTHLY";
  const gap =
    (dates[1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
  if (gap <= 2) return "DAILY";
  if (gap <= 10) return "WEEKLY";
  if (gap <= 20) return "BIWEEKLY";
  return "MONTHLY";
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

  // Métricas sobre préstamos activos (capital comprometido y por venir).
  let lentCapital = 0;
  let totalToCollect = 0;
  const upcoming: {
    operationId: string;
    borrowerName: string | null;
    sequence: number;
    dueDate: Date;
    remaining: number;
  }[] = [];
  for (const op of active) {
    lentCapital += op.capitalUsed;
    for (const c of op.installments) {
      totalToCollect += c.amount;
      const remaining = Math.max(c.amount - c.paidAmount, 0);
      if (remaining > 0) {
        upcoming.push({
          operationId: op.id,
          borrowerName: op.borrowerName,
          sequence: c.sequence,
          dueDate: c.dueDate,
          remaining,
        });
      }
    }
  }

  upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

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
  };
}

// ---------- Escrituras ----------

export async function createLoan(
  input: {
    name: string;
    capital: number;
    returnPct: number;
    startDate: Date;
    term: number;
    frequency: LoanFrequency;
    collectWeekdays?: number[];
    borrowerName?: string | null;
    borrowerPhone?: string | null;
    riskLevel?: "LOW" | "MEDIUM" | "HIGH";
    description?: string | null;
  },
  userId?: string,
) {
  const schedule = buildLoanSchedule(input);
  if (schedule.installments.length === 0) {
    throw new Error("No se pudo generar el calendario de cuotas.");
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
        dailyTermDays: input.term,
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
