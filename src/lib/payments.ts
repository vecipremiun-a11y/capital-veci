/**
 * Cálculo del calendario de pagos de un contrato.
 *
 * Esta función es la **fuente única de verdad**: la usa el simulador del
 * formulario (cliente) y `signContract` (servidor) para generar los pagos
 * reales en la base de datos. Garantiza que lo que se muestra al firmar
 * coincide exactamente con lo que queda agendado.
 *
 * Modelos cubiertos:
 *   - MONTHLY / QUARTERLY  →  interés periódico + capital al vencimiento.
 *   - AT_MATURITY          →  todo al final (bullet): capital + interés total.
 *   - CUSTOM               →  mixto: % del interés periódico, resto + capital al final.
 */

export type PaymentFrequency =
  | "MONTHLY"
  | "QUARTERLY"
  | "AT_MATURITY"
  | "CUSTOM";

export interface ScheduleInput {
  /** Capital del contrato (CLP). */
  amount: number;
  /** Retorno estimado anual (%). */
  annualRate: number;
  /** Duración del contrato en meses. */
  durationMonths: number;
  frequency: PaymentFrequency;
  /** CUSTOM: cada cuántos meses se paga interés. */
  customIntervalMonths?: number;
  /** CUSTOM: % del interés del período que se paga (0–100). El resto acumula al final. */
  periodicInterestPct?: number;
}

export interface ScheduledPayment {
  /** Mes desde el inicio (1..durationMonths). */
  monthOffset: number;
  type: "INTEREST" | "CAPITAL_RETURN";
  amount: number;
  /** Etiqueta humana para el simulador. */
  label: string;
}

export interface ScheduleResult {
  payments: ScheduledPayment[];
  /** Monto de cada cuota periódica de interés (0 si no hay). */
  periodicAmount: number;
  /** Número de cuotas periódicas (sin contar el pago final). */
  periodCount: number;
  /** Interés pagado en el mes final (incluye el del último período + acumulado). */
  accruedAtMaturity: number;
  totalInterest: number;
  totalCapital: number;
  totalToReturn: number;
  /** Resumen del modelo elegido para mostrar al usuario. */
  modelLabel: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Resuelve `frequency` a `{ interval, pct }` (meses entre pagos y % pagado por período). */
function resolveTerms(input: ScheduleInput): { interval: number; pct: number } {
  const { frequency, durationMonths, customIntervalMonths, periodicInterestPct } = input;
  switch (frequency) {
    case "MONTHLY":
      return { interval: 1, pct: 100 };
    case "QUARTERLY":
      return { interval: 3, pct: 100 };
    case "AT_MATURITY":
      // pct=0 hace que no se generen cuotas periódicas; el monto del intervalo da igual.
      return { interval: Math.max(durationMonths, 1), pct: 0 };
    case "CUSTOM": {
      const interval = clamp(
        Math.round(customIntervalMonths ?? 1),
        1,
        Math.max(durationMonths, 1),
      );
      const pct = clamp(periodicInterestPct ?? 50, 0, 100);
      return { interval, pct };
    }
  }
}

const MODEL_LABEL: Record<PaymentFrequency, string> = {
  MONTHLY: "Mensual — interés cada mes + capital al final",
  QUARTERLY: "Trimestral — interés cada 3 meses + capital al final",
  AT_MATURITY: "Al vencimiento — todo al final (bullet)",
  CUSTOM: "Personalizado — mixto",
};

export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const amount = Math.max(input.amount, 0);
  const duration = Math.max(Math.round(input.durationMonths), 1);
  const annualRate = Math.max(input.annualRate, 0);

  const { interval, pct } = resolveTerms({ ...input, durationMonths: duration });

  const monthlyInterest = (amount * (annualRate / 100)) / 12;
  const totalInterest = Math.round(monthlyInterest * duration);
  const interestPerPeriod = monthlyInterest * interval;
  const paidPerPeriod =
    pct > 0 ? Math.round((interestPerPeriod * pct) / 100) : 0;

  const payments: ScheduledPayment[] = [];

  // Cuotas periódicas: en cada hito interval, 2·interval, … estrictamente < duración.
  // (El último mes siempre lleva el pago final, que absorbe el redondeo.)
  let periodCount = 0;
  if (paidPerPeriod > 0) {
    for (let h = interval; h < duration; h += interval) {
      payments.push({
        monthOffset: h,
        type: "INTEREST",
        amount: paidPerPeriod,
        label: `Interés mes ${h}`,
      });
      periodCount++;
    }
  }

  const sumPaidPeriodic = periodCount * paidPerPeriod;
  // Todo lo no pagado (último período + acumulado por pct<100) se paga al final.
  const accruedAtMaturity = Math.max(totalInterest - sumPaidPeriodic, 0);

  if (accruedAtMaturity > 0) {
    payments.push({
      monthOffset: duration,
      type: "INTEREST",
      amount: accruedAtMaturity,
      label: periodCount > 0 ? "Interés final + acumulado" : "Interés total",
    });
  }

  // Devolución de capital — siempre al vencimiento, como registro separado.
  payments.push({
    monthOffset: duration,
    type: "CAPITAL_RETURN",
    amount,
    label: "Devolución de capital",
  });

  return {
    payments,
    periodicAmount: paidPerPeriod,
    periodCount,
    accruedAtMaturity,
    totalInterest,
    totalCapital: amount,
    totalToReturn: amount + totalInterest,
    modelLabel: MODEL_LABEL[input.frequency],
  };
}
