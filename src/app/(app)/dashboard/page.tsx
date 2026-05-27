import Link from "next/link";
import type { Metadata } from "next";
import {
  Wallet,
  Droplets,
  Briefcase,
  TrendingUp,
  Users,
  PiggyBank,
  CalendarClock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  getDashboardMetrics,
  getMonthlyFlow,
  getCapitalGrowth,
} from "@/lib/data/metrics";
import { formatCompact, formatCurrency, formatPercent, formatDate, relativeDays } from "@/lib/format";
import { PAYMENT_TYPE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FlowAreaChart,
  CapitalGrowthChart,
  LiquidityDonut,
} from "@/components/dashboard/charts";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const ALERT_STYLES: Record<string, { dot: string; badge: any }> = {
  DANGER: { dot: "bg-[hsl(var(--danger))]", badge: "danger" },
  WARNING: { dot: "bg-[hsl(var(--warning))]", badge: "warning" },
  SUCCESS: { dot: "bg-[hsl(var(--success))]", badge: "success" },
  INFO: { dot: "bg-gold", badge: "gold" },
};

export default async function DashboardPage() {
  const [metrics, flow, growth, alerts, upcomingPayments, expiringContracts] =
    await Promise.all([
      getDashboardMetrics(),
      getMonthlyFlow(6),
      getCapitalGrowth(8),
      db.alert.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      db.payment.findMany({
        where: { status: { in: ["PENDING", "OVERDUE", "SCHEDULED"] } },
        include: { investor: true },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      db.contract.findMany({
        where: { status: { in: ["ACTIVE", "SIGNED"] } },
        include: { investor: true },
        orderBy: { endDate: "asc" },
        take: 4,
      }),
    ]);

  const liquidityData = [
    {
      name: "Capital trabajando",
      value: metrics.capitalWorking,
      color: "hsl(43, 70%, 55%)",
    },
    {
      name: "Reservas",
      value: metrics.reserves,
      color: "hsl(158, 64%, 45%)",
    },
    {
      name: "Liquidez disponible",
      value: Math.max(metrics.availableLiquidity, 0),
      color: "hsl(222, 14%, 28%)",
    },
  ];

  const liquidityLow = metrics.availableLiquidity < metrics.minLiquidity;
  const overCommitted = metrics.commitmentRatio > metrics.maxCommitment;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen general"
        description="Visión consolidada del capital administrado, liquidez, pagos y riesgo."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/reportes">Ver reportes</Link>
        </Button>
        <Button asChild variant="gold" size="sm">
          <Link href="/inversionistas/nuevo">Nuevo inversionista</Link>
        </Button>
      </PageHeader>

      {/* KPIs principales */}
      <div className="kpi-grid">
        <KpiCard
          label="Capital total administrado"
          value={formatCompact(metrics.totalCapital)}
          icon={Wallet}
          accent="gold"
          delta={{ value: "+8,2%", positive: true }}
          hint="vs. trimestre anterior"
        />
        <KpiCard
          label="Liquidez disponible"
          value={formatCompact(metrics.availableLiquidity)}
          icon={Droplets}
          accent={liquidityLow ? "danger" : "emerald"}
          hint={`${formatPercent(metrics.liquidityRatio)} del capital`}
        />
        <KpiCard
          label="Capital trabajando"
          value={formatCompact(metrics.capitalWorking)}
          icon={Briefcase}
          accent="neutral"
          hint={`${formatPercent(metrics.commitmentRatio)} comprometido`}
        />
        <KpiCard
          label="Rentabilidad mensual"
          value={formatCompact(metrics.monthlyReturn)}
          icon={TrendingUp}
          accent="emerald"
          delta={{ value: "+1,4%", positive: true }}
          hint="interés proyectado"
        />
        <KpiCard
          label="Inversionistas"
          value={String(metrics.totalInvestors)}
          icon={Users}
          accent="neutral"
          hint={`${metrics.activeInvestors} activos · ${metrics.riskInvestors} en riesgo`}
        />
        <KpiCard
          label="Reservas disponibles"
          value={formatCompact(metrics.reserves)}
          icon={PiggyBank}
          accent="gold"
          hint={`${formatPercent(metrics.reservePercentage, 0)} de reserva`}
        />
        <KpiCard
          label="Operaciones activas"
          value={String(metrics.activeOperations)}
          icon={Briefcase}
          accent="emerald"
          hint="en curso"
        />
        <KpiCard
          label="Pagos próximos (30 días)"
          value={formatCompact(metrics.upcomingPaymentsAmount)}
          icon={CalendarClock}
          accent={metrics.overduePaymentsAmount > 0 ? "danger" : "neutral"}
          hint={`${metrics.upcomingPaymentsCount} pagos · ${metrics.upcomingExpirations} vencimientos`}
        />
      </div>

      {/* Alertas críticas */}
      {(liquidityLow || overCommitted || metrics.overduePaymentsAmount > 0) && (
        <Card className="border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <AlertTriangle className="size-5 text-[hsl(var(--danger))]" />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {metrics.overduePaymentsAmount > 0 && (
                <span>
                  Pagos vencidos:{" "}
                  <strong className="text-[hsl(var(--danger))]">
                    {formatCurrency(metrics.overduePaymentsAmount)}
                  </strong>
                </span>
              )}
              {liquidityLow && (
                <span className="text-[hsl(var(--danger))]">
                  Liquidez bajo el mínimo exigido
                </span>
              )}
              {overCommitted && (
                <span className="text-[hsl(var(--warning))]">
                  Capital comprometido sobre el límite ({formatPercent(metrics.commitmentRatio)})
                </span>
              )}
            </div>
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link href="/dashboard/riesgo">Ver riesgo</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Crecimiento de capital</CardTitle>
              <CardDescription>Capital administrado acumulado</CardDescription>
            </div>
            <Badge variant="gold">8 meses</Badge>
          </CardHeader>
          <CardContent>
            <CapitalGrowthChart data={growth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composición de liquidez</CardTitle>
            <CardDescription>Distribución del capital</CardDescription>
          </CardHeader>
          <CardContent>
            <LiquidityDonut data={liquidityData} />
            <div className="mt-4 space-y-2">
              {liquidityData.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: d.color }}
                    />
                    {d.name}
                  </span>
                  <span className="font-medium tabular">
                    {formatCompact(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Flujo financiero</CardTitle>
              <CardDescription>
                Ingresos vs. egresos de los últimos 6 meses
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/flujo">
                Detalle <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <FlowAreaChart data={flow} />
          </CardContent>
        </Card>

        {/* Alertas recientes */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Importantes y recientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin alertas.</p>
            )}
            {alerts.map((a) => {
              const style = ALERT_STYLES[a.level] ?? ALERT_STYLES.INFO;
              return (
                <div key={a.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Pagos próximos + Vencimientos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Pagos próximos</CardTitle>
              <CardDescription>Pendientes, vencidos y programados</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/pagos">
                Ver todos <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {upcomingPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {p.investor.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_TYPE_LABELS[p.type] ?? p.type} ·{" "}
                    {relativeDays(p.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden text-sm font-medium tabular sm:block">
                    {formatCurrency(p.amount)}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vencimientos próximos</CardTitle>
            <CardDescription>Contratos por vencer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiringContracts.map((c) => (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">
                    {c.investor.fullName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(c.endDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.code}</span>
                  <span className="tabular">{formatCompact(c.amount)}</span>
                </div>
              </div>
            ))}
            {expiringContracts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin vencimientos próximos.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
