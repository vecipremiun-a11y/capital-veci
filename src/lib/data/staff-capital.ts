import "server-only";
import { db } from "@/lib/db";
import { OPERATION_COMMITTED_STATUSES, STAFF_ROLES } from "@/lib/constants";

/**
 * Caja de un trabajador (modelo de efectivo en mano).
 *
 * La empresa le entrega efectivo para que lo coloque en préstamos. Ese
 * efectivo se mueve así:
 *
 *   entregado   →  la empresa le pasa plata            (StaffAssignment ASSIGN)
 *   devuelto    →  él le devuelve plata a la empresa   (StaffAssignment RETURN)
 *   colocado    →  sale de su mano al prestar          (Operation.capitalUsed)
 *   recuperado  →  vuelve a su mano al cobrar          (cuotas cobradas / retorno)
 *
 *   disponible  =  entregado − devuelto − colocado + recuperado
 *
 * "Recuperado" se toma de las CUOTAS cobradas (LoanInstallment.paidAmount) en
 * los préstamos en cuotas, y del returnAmount en las operaciones cerradas que
 * no llevan calendario. Nunca de ambos, para no contar dos veces la misma
 * plata cuando un préstamo diario se finaliza.
 */
export interface StaffCapital {
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;

  /** Suma de entregas de la empresa. */
  handedOut: number;
  /** Suma de devoluciones a la empresa. */
  returned: number;
  /** handedOut − returned: capital que la empresa le confió y sigue en su poder. */
  assigned: number;

  /** Capital colocado en operaciones vivas (ACTIVE/PAUSED/RISK). */
  working: number;
  /** Lo que debería volver de esas operaciones: capital + interés pactado. */
  expected: number;
  /** Lo que aún falta cobrar de esas operaciones (capital + interés). */
  toCollect: number;
  /** Efectivo que ya recuperó cobrando. */
  collected: number;
  /** Efectivo en mano: lo que puede volver a prestar hoy. */
  available: number;

  /** Operaciones vivas a su nombre. */
  liveOperations: number;
  /** Operaciones totales a su nombre. */
  totalOperations: number;
  /** Utilidad realizada en sus operaciones cerradas. */
  profit: number;
}

const LIVE = OPERATION_COMMITTED_STATUSES as readonly string[];

/** Operación con lo mínimo para calcular la caja. */
type OperationForCash = {
  status: string;
  capitalUsed: number;
  expectedReturn: number;
  returnAmount: number | null;
  profit: number | null;
  isDailyLoan: boolean;
  installments: { amount: number; paidAmount: number }[];
};

function summarize(ops: OperationForCash[]) {
  let placed = 0;
  let recovered = 0;
  let working = 0;
  let expected = 0;
  let toCollect = 0;
  let collected = 0;
  let profit = 0;
  let live = 0;

  for (const op of ops) {
    placed += op.capitalUsed;

    const hasSchedule = op.installments.length > 0;
    const scheduleTotal = op.installments.reduce((s, c) => s + c.amount, 0);
    const paid = op.installments.reduce((s, c) => s + c.paidAmount, 0);
    const pending = op.installments.reduce(
      (s, c) => s + Math.max(c.amount - c.paidAmount, 0),
      0,
    );

    if (hasSchedule) {
      // Préstamo en cuotas: el efectivo vuelve cobro a cobro.
      collected += paid;
      recovered += paid;
    } else if (op.status === "FINISHED" || op.status === "LOSS") {
      // Operación sin calendario: el efectivo vuelve al cerrarla.
      const back = op.returnAmount ?? 0;
      collected += back;
      recovered += back;
    }

    if (LIVE.includes(op.status)) {
      live++;
      working += op.capitalUsed;
      toCollect += pending;
      // Lo que debería volver: el total del calendario de cuotas si lo tiene;
      // si no, el capital más el retorno pactado.
      expected += hasSchedule
        ? scheduleTotal
        : op.capitalUsed * (1 + op.expectedReturn / 100);
    }
    if (op.status === "FINISHED" || op.status === "LOSS") {
      profit += op.profit ?? 0;
    }
  }

  return {
    placed,
    recovered,
    working,
    expected,
    toCollect,
    collected,
    profit,
    live,
  };
}

const OPERATION_SELECT = {
  status: true,
  capitalUsed: true,
  expectedReturn: true,
  returnAmount: true,
  profit: true,
  isDailyLoan: true,
  installments: { select: { amount: true, paidAmount: true } },
} as const;

/** Caja de todos los trabajadores (staff), ordenada por efectivo colocado. */
export async function getStaffCapital(): Promise<StaffCapital[]> {
  const users = await db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    orderBy: { name: "asc" },
    include: {
      capitalAssignments: { select: { type: true, amount: true } },
      responsibleOperations: { select: OPERATION_SELECT },
    },
  });

  return users.map((u) => {
    const handedOut = u.capitalAssignments
      .filter((a) => a.type === "ASSIGN")
      .reduce((s, a) => s + a.amount, 0);
    const returned = u.capitalAssignments
      .filter((a) => a.type === "RETURN")
      .reduce((s, a) => s + a.amount, 0);

    const t = summarize(u.responsibleOperations);

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      handedOut,
      returned,
      assigned: handedOut - returned,
      working: t.working,
      expected: t.expected,
      toCollect: t.toCollect,
      collected: t.collected,
      available: handedOut - returned - t.placed + t.recovered,
      liveOperations: t.live,
      totalOperations: u.responsibleOperations.length,
      profit: t.profit,
    };
  });
}

/** Caja de un trabajador concreto, con su historial y sus operaciones. */
export async function getStaffMemberCapital(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      capitalAssignments: {
        orderBy: { date: "desc" },
        include: { author: { select: { name: true } } },
      },
      responsibleOperations: {
        orderBy: { startDate: "desc" },
        include: {
          installments: { select: { amount: true, paidAmount: true } },
        },
      },
    },
  });
  if (!user) return null;

  const handedOut = user.capitalAssignments
    .filter((a) => a.type === "ASSIGN")
    .reduce((s, a) => s + a.amount, 0);
  const returned = user.capitalAssignments
    .filter((a) => a.type === "RETURN")
    .reduce((s, a) => s + a.amount, 0);

  const t = summarize(user.responsibleOperations);

  const capital: StaffCapital = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    handedOut,
    returned,
    assigned: handedOut - returned,
    working: t.working,
    expected: t.expected,
    toCollect: t.toCollect,
    collected: t.collected,
    available: handedOut - returned - t.placed + t.recovered,
    liveOperations: t.live,
    totalOperations: user.responsibleOperations.length,
    profit: t.profit,
  };

  return {
    capital,
    assignments: user.capitalAssignments,
    operations: user.responsibleOperations,
  };
}

// ---------------------------------------------------------
//  Reparto del capital del fondo
// ---------------------------------------------------------

/**
 * Dónde está físicamente la plata del fondo. Son tres lugares excluyentes:
 *
 *   1. En manos de trabajadores  → se la entregaste (esté en su bolsillo o
 *                                  ya colocada en préstamos suyos)
 *   2. Colocada por la empresa   → préstamos financiados directo desde la caja
 *   3. Sin asignar               → lo que queda en la caja de la empresa
 *
 *   sinAsignar = capitalTotal − enCustodia − colocadoPorLaEmpresa
 *
 * Se usa la CUSTODIA (entregado − devuelto) y no el efectivo en mano del
 * trabajador: cuando él cobra una cuota, esa plata vuelve a su bolsillo pero
 * sigue siendo parte de lo que la empresa le confió, así que la caja de la
 * empresa no cambia. Contar el efectivo en mano haría que "sin asignar"
 * bajara sola cada vez que alguien cobra, que es justo lo que no queremos.
 */
export interface CapitalAllocation {
  /** Capital del fondo = suma del capital de los inversionistas. */
  totalCapital: number;
  /** Entregado a trabajadores y no devuelto. */
  inCustody: number;
  /** Capital vigente colocado por trabajadores con capital entregado. */
  workerPlaced: number;
  /** Capital vigente colocado directamente con plata de la caja. */
  companyPlaced: number;
  /** Lo que queda en la caja de la empresa, sin asignar a nadie. */
  unassigned: number;
  /** Reserva exigida por política (Configuración). */
  reserves: number;
  reservePercentage: number;
  /** Sin asignar menos la reserva: lo que realmente puedes repartir hoy. */
  freeToAssign: number;
}

export async function getCapitalAllocation(): Promise<CapitalAllocation> {
  const [investors, settings, staff, liveOps] = await Promise.all([
    db.investor.findMany({ select: { investedCapital: true } }),
    db.companySettings.findUnique({ where: { id: "singleton" } }),
    getStaffCapital(),
    db.operation.findMany({
      where: { status: { in: [...OPERATION_COMMITTED_STATUSES] } },
      select: { capitalUsed: true, responsibleId: true },
    }),
  ]);

  const totalCapital = investors.reduce((s, i) => s + i.investedCapital, 0);
  const inCustody = staff.reduce((s, w) => s + w.assigned, 0);

  // Un préstamo se financió con plata del trabajador solo si a ese trabajador
  // se le entregó capital; si no, salió de la caja de la empresa.
  const funded = new Set(
    staff.filter((w) => w.assigned > 0).map((w) => w.userId),
  );
  let workerPlaced = 0;
  let companyPlaced = 0;
  for (const op of liveOps) {
    if (op.responsibleId && funded.has(op.responsibleId)) {
      workerPlaced += op.capitalUsed;
    } else {
      companyPlaced += op.capitalUsed;
    }
  }

  const reservePercentage = settings?.reservePercentage ?? 20;
  const reserves = Math.round(totalCapital * (reservePercentage / 100));
  const unassigned = totalCapital - inCustody - companyPlaced;

  return {
    totalCapital,
    inCustody,
    workerPlaced,
    companyPlaced,
    unassigned,
    reserves,
    reservePercentage,
    freeToAssign: unassigned - reserves,
  };
}

// ---------------------------------------------------------
//  Desglose del efectivo en mano e historial de movimientos
// ---------------------------------------------------------

/**
 * De qué está hecho el efectivo que el trabajador tiene ahora:
 *
 *   - fromCapital     → lo que queda del capital que le entregó la empresa
 *   - fromCollections → cobranza que entró y todavía no vuelve a prestar
 *
 * Al prestar se descuenta PRIMERO de la cobranza y después del capital, así
 * que la cobranza que quede a la vista es plata realmente disponible que
 * volvió del giro, no capital sin colocar.
 */
export interface CashSplit {
  fromCapital: number;
  fromCollections: number;
}

export interface ActivityPeriod {
  key: string;
  label: string;
  /** Cobrado en el período (libro de cobros). */
  collected: number;
  /** Capital prestado en el período. */
  lent: number;
  /** collected − lent: cuánto creció o bajó el efectivo en mano. */
  net: number;
}

export interface StaffActivity {
  day: ActivityPeriod[];
  week: ActivityPeriod[];
  month: ActivityPeriod[];
}

// Las fechas "solo día" (inicio de un préstamo) se guardan a medianoche UTC:
// se agrupan en UTC para no correrlas un día. Los cobros son marcas de tiempo
// reales, así que se agrupan en hora de Chile.
const DAY_UTC = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DAY_CL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DAY_LABEL = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const DAY_SHORT = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});
const MONTH_LABEL = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "2026-08-25" → Date a medianoche UTC de ese día. */
function fromDayKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Lunes de la semana de ese día, como clave. */
function weekKey(dayKey: string): string {
  const d = fromDayKey(dayKey);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dow);
  return DAY_UTC.format(d);
}

function periodLabel(kind: "day" | "week" | "month", key: string): string {
  if (kind === "month") return MONTH_LABEL.format(fromDayKey(`${key}-01`));
  if (kind === "day") return DAY_LABEL.format(fromDayKey(key));
  const start = fromDayKey(key);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${DAY_SHORT.format(start)} – ${DAY_SHORT.format(end)}`;
}

type CashEvent = {
  at: Date;
  kind: "ASSIGN" | "RETURN" | "LEND" | "COLLECT";
  amount: number;
  /** Día de negocio al que pertenece (ya resuelto en la zona correcta). */
  dayKey: string;
};

function buildPeriods(
  kind: "day" | "week" | "month",
  events: CashEvent[],
): ActivityPeriod[] {
  const acc = new Map<string, { collected: number; lent: number }>();
  for (const e of events) {
    if (e.kind !== "COLLECT" && e.kind !== "LEND") continue;
    const key =
      kind === "day"
        ? e.dayKey
        : kind === "week"
          ? weekKey(e.dayKey)
          : e.dayKey.slice(0, 7);
    const row = acc.get(key) ?? { collected: 0, lent: 0 };
    if (e.kind === "COLLECT") row.collected += e.amount;
    else row.lent += e.amount;
    acc.set(key, row);
  }
  return [...acc.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, v]) => ({
      key,
      label: periodLabel(kind, key),
      collected: v.collected,
      lent: v.lent,
      net: v.collected - v.lent,
    }));
}

/**
 * Recorre los movimientos del trabajador en orden y reparte su efectivo entre
 * capital y cobranza, aplicando la regla "al prestar sale primero de lo
 * cobrado". Devuelve además el historial agrupado por día, semana y mes.
 */
export async function getStaffLedger(userId: string): Promise<{
  split: CashSplit;
  activity: StaffActivity;
  events: CashEvent[];
}> {
  const [assignments, operations, collections] = await Promise.all([
    db.staffAssignment.findMany({
      where: { userId },
      select: { type: true, amount: true, date: true },
    }),
    db.operation.findMany({
      where: { responsibleId: userId },
      select: {
        id: true,
        capitalUsed: true,
        startDate: true,
        status: true,
        returnAmount: true,
        closedAt: true,
        installments: { select: { id: true } },
      },
    }),
    db.loanPayment.findMany({
      where: { operation: { responsibleId: userId } },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const events: CashEvent[] = [];

  for (const a of assignments) {
    events.push({
      at: a.date,
      kind: a.type === "RETURN" ? "RETURN" : "ASSIGN",
      amount: a.amount,
      dayKey: DAY_UTC.format(a.date),
    });
  }

  for (const op of operations) {
    events.push({
      at: op.startDate,
      kind: "LEND",
      amount: op.capitalUsed,
      dayKey: DAY_UTC.format(op.startDate),
    });
    // Operación sin calendario: el efectivo vuelve entero al cerrarla.
    if (
      op.installments.length === 0 &&
      (op.status === "FINISHED" || op.status === "LOSS") &&
      op.returnAmount
    ) {
      const at = op.closedAt ?? op.startDate;
      events.push({
        at,
        kind: "COLLECT",
        amount: op.returnAmount,
        dayKey: DAY_CL.format(at),
      });
    }
  }

  for (const p of collections) {
    events.push({
      at: p.createdAt,
      kind: "COLLECT",
      amount: p.amount,
      dayKey: DAY_CL.format(p.createdAt),
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  let fromCapital = 0;
  let fromCollections = 0;
  for (const e of events) {
    if (e.kind === "ASSIGN") {
      fromCapital += e.amount;
    } else if (e.kind === "COLLECT") {
      fromCollections += e.amount;
    } else if (e.kind === "LEND") {
      // Regla del negocio: presta primero con lo cobrado.
      const fromColl = Math.min(fromCollections, e.amount);
      fromCollections -= fromColl;
      fromCapital -= e.amount - fromColl;
    } else {
      // Devolución a la empresa: sale del capital y, si no alcanza, de la cobranza.
      const fromCap = Math.min(Math.max(fromCapital, 0), e.amount);
      fromCapital -= fromCap;
      fromCollections -= e.amount - fromCap;
    }
  }

  return {
    split: { fromCapital, fromCollections },
    activity: {
      day: buildPeriods("day", events),
      week: buildPeriods("week", events),
      month: buildPeriods("month", events),
    },
    events,
  };
}
