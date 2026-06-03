/** Utilidades de formato (moneda CLP, fechas, porcentajes, RUT). */

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const CLP_COMPACT = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "$0";
  return CLP.format(value);
}

/** Versión compacta para KPIs: $1,2 M, $850 K, etc. */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "$0";
  return "$" + CLP_COMPACT.format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("es-CL").format(value);
}

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFmt.format(d);
}

/** Días entre hoy y una fecha (negativo si ya pasó). */
export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function relativeDays(date: Date | string): string {
  const days = daysUntil(date);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  if (days > 0) return `En ${days} días`;
  return `Hace ${Math.abs(days)} días`;
}

/** Deja solo dígitos y K, en mayúscula: " 12.345.678-k " -> "12345678K" */
export function cleanRut(rut: string | null | undefined): string {
  if (!rut) return "";
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Forma canónica para guardar / comparar: 12345678-9 (sin puntos). */
export function normalizeRut(rut: string | null | undefined): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

/**
 * Valida un RUT chileno con su dígito verificador (módulo 11).
 * Rechaza RUTs con dígito verificador incorrecto.
 */
export function validateRut(rut: string | null | undefined): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return expected === dv;
}

/** Formatea un RUT chileno: 12345678-9 -> 12.345.678-9 */
export function formatRut(rut: string | null | undefined): string {
  if (!rut) return "—";
  const clean = cleanRut(rut);
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}
