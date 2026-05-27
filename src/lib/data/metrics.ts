import "server-only";
import { db } from "@/lib/db";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export interface DashboardMetrics {
  totalCapital: number;
  capitalWorking: number;
  reserves: number;
  availableLiquidity: number;
  liquidityRatio: number;
  commitmentRatio: number;
  monthlyReturn: number;
  realizedThisMonth: number;
  totalInvestors: number;
  activeInvestors: number;
  riskInvestors: number;
  activeOperations: number;
  upcomingPaymentsCount: number;
  upcomingPaymentsAmount: number;
  overduePaymentsAmount: number;
  upcomingExpirations: number;
  reservePercentage: number;
  minLiquidity: number;
  maxCommitment: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [investors, operations, contracts, payments, settings] =
    await Promise.all([
      db.investor.findMany(),
      db.operation.findMany(),
      db.contract.findMany(),
      db.payment.findMany(),
      db.companySettings.findUnique({ where: { id: "singleton" } }),
    ]);

  const reservePercentage = settings?.reservePercentage ?? 20;
  const minLiquidity = settings?.minLiquidity ?? 0;
  const maxCommitment = settings?.maxCommitment ?? 80;

  const totalCapital = investors.reduce((s, i) => s + i.investedCapital, 0);
  const capitalWorking = operations
    .filter((o) => o.status === "ACTIVE" || o.status === "RISK")
    .reduce((s, o) => s + o.capitalUsed, 0);
  const reserves = Math.round(totalCapital * (reservePercentage / 100));
  const availableLiquidity = totalCapital - capitalWorking - reserves;
  const liquidityRatio =
    totalCapital > 0 ? (availableLiquidity / totalCapital) * 100 : 0;
  const commitmentRatio =
    totalCapital > 0 ? (capitalWorking / totalCapital) * 100 : 0;

  // Rentabilidad mensual esperada (interés mensual de contratos activos)
  const activeContracts = contracts.filter(
    (c) => c.status === "ACTIVE" || c.status === "SIGNED",
  );
  const monthlyReturn = Math.round(
    activeContracts.reduce(
      (s, c) => s + (c.amount * (c.returnRate / 100)) / 12,
      0,
    ),
  );

  const now = new Date();
  const thisMonthKey = monthKey(now);
  const realizedThisMonth = payments
    .filter(
      (p) =>
        p.status === "PAID" &&
        p.paidDate &&
        monthKey(new Date(p.paidDate)) === thisMonthKey,
    )
    .reduce((s, p) => s + p.amount, 0);

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const upcoming = payments.filter(
    (p) =>
      (p.status === "PENDING" || p.status === "SCHEDULED") &&
      new Date(p.dueDate) <= in30 &&
      new Date(p.dueDate) >= now,
  );
  const overdue = payments.filter((p) => p.status === "OVERDUE");

  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  const upcomingExpirations = contracts.filter(
    (c) =>
      (c.status === "ACTIVE" || c.status === "SIGNED") &&
      new Date(c.endDate) <= in60 &&
      new Date(c.endDate) >= now,
  ).length;

  return {
    totalCapital,
    capitalWorking,
    reserves,
    availableLiquidity,
    liquidityRatio,
    commitmentRatio,
    monthlyReturn,
    realizedThisMonth,
    totalInvestors: investors.length,
    activeInvestors: investors.filter((i) => i.status === "ACTIVE").length,
    riskInvestors: investors.filter((i) => i.status === "RISK").length,
    activeOperations: operations.filter((o) => o.status === "ACTIVE").length,
    upcomingPaymentsCount: upcoming.length,
    upcomingPaymentsAmount: upcoming.reduce((s, p) => s + p.amount, 0),
    overduePaymentsAmount: overdue.reduce((s, p) => s + p.amount, 0),
    upcomingExpirations,
    reservePercentage,
    minLiquidity,
    maxCommitment,
  };
}

export interface MonthlyFlow {
  month: string;
  ingresos: number;
  egresos: number;
}

/** Serie de flujo financiero de los últimos N meses. */
export async function getMonthlyFlow(months = 6): Promise<MonthlyFlow[]> {
  const [payments, movements] = await Promise.all([
    db.payment.findMany({ where: { status: "PAID" } }),
    db.capitalMovement.findMany({ where: { type: "RETURN" } }),
  ]);

  const series: MonthlyFlow[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const egresos = payments
      .filter((p) => p.paidDate && monthKey(new Date(p.paidDate)) === key)
      .reduce((s, p) => s + p.amount, 0);
    const ingresos = movements
      .filter((m) => monthKey(new Date(m.date)) === key)
      .reduce((s, m) => s + m.amount, 0);
    series.push({ month: MONTH_LABELS[d.getMonth()], ingresos, egresos });
  }
  return series;
}

export interface CapitalGrowthPoint {
  month: string;
  capital: number;
}

/** Crecimiento acumulado de capital administrado (aprox. por aportes). */
export async function getCapitalGrowth(months = 8): Promise<CapitalGrowthPoint[]> {
  const investors = await db.investor.findMany();
  const now = new Date();
  const points: CapitalGrowthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const capital = investors
      .filter((inv) => new Date(inv.joinDate) <= cutoff)
      .reduce((s, inv) => s + inv.investedCapital, 0);
    points.push({ month: MONTH_LABELS[cutoff.getMonth()], capital });
  }
  return points;
}
