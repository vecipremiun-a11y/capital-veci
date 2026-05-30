/**
 * Cálculo del calendario de cobro diario de un préstamo.
 *
 * Esta función es la **fuente única de verdad** (mismo rol que `buildSchedule`
 * en src/lib/payments.ts): la usa el preview del formulario (cliente) y
 * `createOperation` (servidor) para generar las cuotas reales en la base.
 * Así, lo que se muestra al crear coincide exactamente con lo que queda
 * agendado para cobrar.
 *
 * Modelo:
 *   total a cobrar = capital × (1 + retorno% / 100)   ← interés plano sobre el total
 *   cuota diaria   = total / N                          ← N = días de cobro
 *   las cuotas empiezan el DÍA SIGUIENTE a la fecha de inicio y solo caen en
 *   los días de la semana habilitados (ej. lun–sáb, saltando domingos).
 */

export interface DailyLoanInput {
  /** Capital prestado (CLP). */
  capital: number;
  /** Retorno esperado (%) plano sobre el total del préstamo. */
  returnPct: number;
  /** Fecha de inicio de la operación. El primer cobro es al día siguiente. */
  startDate: Date;
  /** Número de cuotas/días de cobro (ej. 24, 20, 30). */
  termDays: number;
  /** Días de la semana en que SÍ se cobra (0=Dom … 6=Sáb), ej [1,2,3,4,5,6]. */
  collectWeekdays: number[];
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
  /** Monto base por cuota (la última absorbe el redondeo). */
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

export function buildDailyLoanSchedule(input: DailyLoanInput): DailyLoanSchedule {
  const capital = Math.max(input.capital, 0);
  const returnPct = Math.max(input.returnPct, 0);
  const term = Math.max(Math.round(input.termDays), 0);

  // Si no se especifica ningún día, se cobra todos los días (defensivo).
  const allowed =
    input.collectWeekdays && input.collectWeekdays.length > 0
      ? new Set(input.collectWeekdays)
      : new Set([0, 1, 2, 3, 4, 5, 6]);

  const total = Math.round(capital * (1 + returnPct / 100));
  const base = term > 0 ? Math.floor(total / term) : 0;

  const installments: DailyInstallment[] = [];
  // Arranca el día siguiente a la fecha de inicio.
  let cursor = addDays(input.startDate, 1);
  // Límite de seguridad para no iterar infinito si `allowed` quedara vacío.
  let guard = 0;
  const maxGuard = term * 14 + 14;

  while (installments.length < term && guard < maxGuard) {
    if (allowed.has(cursor.getDay())) {
      const sequence = installments.length + 1;
      // La última cuota absorbe el redondeo para cuadrar el total exacto.
      const amount =
        sequence === term ? total - base * (term - 1) : base;
      installments.push({ sequence, dueDate: new Date(cursor), amount });
    }
    cursor = addDays(cursor, 1);
    guard++;
  }

  return {
    total,
    dailyAmount: base,
    installments,
    firstDate: installments[0]?.dueDate ?? null,
    endDate: installments[installments.length - 1]?.dueDate ?? null,
    daysCount: installments.length,
  };
}
