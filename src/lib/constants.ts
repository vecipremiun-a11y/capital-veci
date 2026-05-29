/**
 * Valores de dominio centralizados. Como SQLite no soporta enums nativos,
 * estos objetos son la fuente de verdad para estados, roles y etiquetas.
 */

export const ROLES = {
  ADMIN: "ADMIN",
  CONTADOR: "CONTADOR",
  OPERADOR: "OPERADOR",
  INVERSIONISTA: "INVERSIONISTA",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CONTADOR: "Contador",
  OPERADOR: "Operador",
  INVERSIONISTA: "Inversionista",
};

/** Permisos por rol — usados en la UI y en las server actions. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "dashboard",
    "investors",
    "contracts",
    "payments",
    "liquidity",
    "operations",
    "reports",
    "admin",
    "settings",
    "edit_payments",
    "generate_contracts",
    "approve_movements",
  ],
  CONTADOR: [
    "dashboard",
    "investors",
    "contracts",
    "payments",
    "liquidity",
    "reports",
    "edit_payments",
  ],
  OPERADOR: ["dashboard", "investors", "operations", "contracts"],
  INVERSIONISTA: ["portal"],
};

export const INVESTOR_STATUS = {
  ACTIVE: "ACTIVE",
  FINISHED: "FINISHED",
  RISK: "RISK",
  BLOCKED: "BLOCKED",
} as const;

export const INVESTOR_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  FINISHED: "Finalizado",
  RISK: "En riesgo",
  BLOCKED: "Bloqueado",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SIGNED: "Firmado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};

export const CONTRACT_MODALITY_LABELS: Record<string, string> = {
  FIXED: "Renta fija",
  VARIABLE: "Renta variable",
  PARTICIPATION: "Participación",
};

export const PAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  AT_MATURITY: "Al vencimiento",
  CUSTOM: "Personalizado (mixto)",
};

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "AT_MATURITY", label: "Al vencimiento" },
  { value: "CUSTOM", label: "Personalizado (mixto)" },
] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  SCHEDULED: "Programado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  INTEREST: "Interés",
  CAPITAL_RETURN: "Devolución de capital",
  MONTHLY: "Pago mensual",
  OTHER: "Otro",
};

export const OPERATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  RISK: "En riesgo",
  FINISHED: "Finalizada",
  LOSS: "Pérdida",
};

/**
 * Estados que mantienen el capital comprometido (no devuelven liquidez):
 * ACTIVE, PAUSED y RISK siguen contando como capital trabajando.
 * FINISHED ya devolvió el dinero. LOSS ya descontó del capital total.
 */
export const OPERATION_COMMITTED_STATUSES = ["ACTIVE", "PAUSED", "RISK"] as const;

export const OPERATION_CATEGORY_LABELS: Record<string, string> = {
  MINIMARKET: "Minimarket",
  LOANS: "Préstamos",
  BARBERSHOP: "Barbería",
  SOFTWARE: "Software",
  CLEANING: "Limpieza",
  IMPORTS: "Importaciones",
  STOCK: "Stock",
  COMMERCIAL: "Comercial",
  EXPANSION: "Expansión",
};

export const OPERATION_CATEGORY_OPTIONS = Object.entries(
  OPERATION_CATEGORY_LABELS,
).map(([value, label]) => ({ value, label }));

export const RISK_LABELS: Record<string, string> = {
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INFLOW: "Ingreso de capital",
  OUTFLOW: "Egreso",
  RESERVE: "Reserva",
  COMMITTED: "Capital comprometido",
  RETURN: "Retorno de operación",
  LOSS: "Pérdida registrada",
};
