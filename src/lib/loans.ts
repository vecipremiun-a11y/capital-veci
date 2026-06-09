/**
 * Cálculo del calendario de cobro de un préstamo en cuotas.
 *
 * Esta función es la **fuente única de verdad** (mismo rol que `buildSchedule`
 * en src/lib/payments.ts): la usa el preview del formulario (cliente),
 * `createOperation` (servidor) y la API de la app externa. Así, lo que se
 * muestra al crear coincide exactamente con lo que queda agendado para cobrar.
 *
 * Modelo:
 *   total a cobrar = capital × (1 + retorno% / 100)   ← interés plano sobre el total
 *   modo "TERM"         → cuota = total / N (N = N° de cuotas); la última absorbe
 *                         el redondeo.
 *   modo "DAILY_AMOUNT" → se fija la cuota redonda y se derivan las cuotas; el
 *                         resto queda en una cuota de cierre (más chica) al final.
 *
 *   Frecuencia define el espaciado entre cuotas:
 *     DAILY    → un día hábil tras otro (salta los días de la semana no cobrados).
 *     WEEKLY   → cada 7 días · BIWEEKLY → cada 15 días · MONTHLY → cada mes.
 *   La primera cuota cae un período DESPUÉS de la fecha de inicio.
 */

export type LoanFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface DailyLoanInput {
  /** Capital prestado (CLP). */
  capital: number;
  /** Retorno esperado (%) plano sobre el total del préstamo. */
  returnPct: number;
  /** Fecha de inicio de la operación. El primer cobro es un período después. */
  startDate: Date;
  /** Número de cuotas (modo "TERM"). */
  termDays: number;
  /** Días de la semana en que SÍ se cobra (0=Dom … 6=Sáb). Solo aplica a DAILY. */
  collectWeekdays: number[];
  /**
   * Cómo se calcula el calendario:
   *   "TERM"         → se fija el N° de cuotas y la cuota = total/N.
   *   "DAILY_AMOUNT" → se fija el monto por cuota (`dailyAmount`) y se deriva
   *                    cuántas cuotas salen; el resto va en una cuota de cierre.
   */
  mode?: "TERM" | "DAILY_AMOUNT";
  /** Monto objetivo por cuota (CLP) cuando `mode === "DAILY_AMOUNT"`. */
  dailyAmount?: number;
}

/** Igual que `DailyLoanInput`, pero con la frecuencia del calendario. */
export interface LoanScheduleInput extends DailyLoanInput {
  frequency: LoanFrequency;
}

export interface DailyInstallment {
  /** Número de cuota (1..N). */
  sequence: number;
  dueDate: Date;
  amount: number;
}

export interface DailyLoanSchedule {
  /** Total a cobrar = round(capital × (1 + retorno%/100)). */
  total: number;
  /** Monto representativo por cuota (la cuota regular). */
  dailyAmount: number;
  installments: DailyInstallment[];
  /** Fecha de la primera cuota (null si no se generó ninguna). */
  firstDate: Date | null;
  /** Fecha de la última cuota (null si no se generó ninguna). */
  endDate: Date | null;
  /** Número de cuotas efectivamente generadas. */
  daysCount: number;
}

/** Suma `days` días naturales a una fecha (sin mutar la original). */
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Suma `months` meses a una fecha (sin mutar la original). */
function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/**
 * Decide el MONTO de cada cuota (independiente de las fechas), según el modo.
 *   TERM         → cuota = floor(total/N); la última absorbe el redondeo.
 *   DAILY_AMOUNT → cuotas redondas de `dailyAmount` + cuota de cierre con el resto.
 */
function computeAmounts(
  total: number,
  mode: "TERM" | "DAILY_AMOUNT",
  termDays: number,
  dailyAmount: number,
): number[] {
  if (total <= 0) return [];

  if (mode === "DAILY_AMOUNT") {
    const per = Math.min(Math.round(Math.max(dailyAmount, 0)), total);
    if (per <= 0) return [];
    const full = Math.floor(total / per);
    const remainder = total - per * full;
    const amounts = new Array<number>(full).fill(per);
    if (remainder > 0) amounts.push(remainder);
    return amounts;
  }

  const term = Math.max(Math.round(termDays), 0);
  if (term <= 0) return [];
  const base = Math.floor(total / term);
  const amounts: number[] = [];
  for (let k = 1; k <= term; k++) {
    amounts.push(k === term ? total - base * (term - 1) : base);
  }
  return amounts;
}

/**
 * Genera el calendario completo para cualquier frecuencia. Es la función
 * principal; `buildDailyLoanSchedule` es un atajo con frequency = "DAILY".
 */
export function buildLoanSchedule(input: LoanScheduleInput): DailyLoanSchedule {
  const capital = Math.max(input.capital, 0);
  const returnPct = Math.max(input.returnPct, 0);
  const mode = input.mode ?? "TERM";
  const total = Math.round(capital * (1 + returnPct / 100));

  const amounts = computeAmounts(total, mode, input.termDays, input.dailyAmount ?? 0);
  const count = amounts.length;
  const dailyAmount = amounts[0] ?? 0;

  const installments: DailyInstallment[] = [];

  if (input.frequency === "DAILY") {
    // Si no se especifica ningún día, se cobra todos los días (defensivo).
    const allowed =
      input.collectWeekdays && input.collectWeekdays.length > 0
        ? new Set(input.collectWeekdays)
        : new Set([0, 1, 2, 3, 4, 5, 6]);

    // Arranca el día siguiente a la fecha de inicio y salta los días no hábiles.
    let cursor = addDays(input.startDate, 1);
    let guard = 0;
    const maxGuard = count * 14 + 14;
    while (installments.length < count && guard < maxGuard) {
      if (allowed.has(cursor.getDay())) {
        const sequence = installments.length + 1;
        installments.push({
          sequence,
          dueDate: new Date(cursor),
          amount: amounts[sequence - 1],
        });
      }
      cursor = addDays(cursor, 1);
      guard++;
    }
  } else {
    // Semanal / quincenal / mensual: una cuota cada período, empezando un
    // período después de la fecha de inicio.
    const stepDays =
      input.frequency === "WEEKLY" ? 7 : input.frequency === "BIWEEKLY" ? 15 : 0;
    for (let k = 1; k <= count; k++) {
      const dueDate =
        input.frequency === "MONTHLY"
          ? addMonths(input.startDate, k)
          : addDays(input.startDate, stepDays * k);
      installments.push({ sequence: k, dueDate, amount: amounts[k - 1] });
    }
  }

  return {
    total,
    dailyAmount,
    installments,
    firstDate: installments[0]?.dueDate ?? null,
    endDate: installments[installments.length - 1]?.dueDate ?? null,
    daysCount: installments.length,
  };
}

/** Atajo histórico: calendario de cobro DIARIO (días hábiles). */
export function buildDailyLoanSchedule(input: DailyLoanInput): DailyLoanSchedule {
  return buildLoanSchedule({ ...input, frequency: "DAILY" });
}
