import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { db } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/data/metrics";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskBadge, StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Riesgo y liquidez" };
export const dynamic = "force-dynamic";

const ALERT_LEVEL: Record<string, { dot: string; badge: any; icon: any }> = {
  DANGER: { dot: "bg-[hsl(var(--danger))]", badge: "danger", icon: AlertTriangle },
  WARNING: { dot: "bg-[hsl(var(--warning))]", badge: "warning", icon: AlertTriangle },
  INFO: { dot: "bg-gold", badge: "gold", icon: ShieldCheck },
  SUCCESS: { dot: "bg-[hsl(var(--success))]", badge: "success", icon: CheckCircle2 },
};

export default async function RiskPage() {
  const [metrics, alerts, riskInvestors, riskOperations, overduePayments] =
    await Promise.all([
      getDashboardMetrics(),
      db.alert.findMany({ orderBy: { createdAt: "desc" } }),
      db.investor.findMany({ where: { status: "RISK" } }),
      db.operation.findMany({ where: { status: "RISK" } }),
      db.payment.findMany({
        where: { status: "OVERDUE" },
        include: { investor: true },
        orderBy: { dueDate: "asc" },
      }),
    ]);

  const liquidityLow = metrics.availableLiquidity < metrics.minLiquidity;
  const overCommitted = metrics.commitmentRatio > metrics.maxCommitment;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riesgo y liquidez"
        description="Indicadores de riesgo, alertas y exposiciones críticas."
      >
        <Badge variant={liquidityLow || overCommitted || riskInvestors.length > 0 ? "danger" : "success"}>
          {liquidityLow || overCommitted ? "Riesgo elevado" : "Riesgo controlado"}
        </Badge>
      </PageHeader>

      {/* Tarjetas de riesgo */}
      <div className="grid gap-4 lg:grid-cols-4">
        <RiskTile
          ok={!liquidityLow}
          label="Liquidez vs mínimo"
          value={formatPercent(metrics.liquidityRatio)}
          hint={`Mínimo: ${formatCurrency(metrics.minLiquidity)}`}
        />
        <RiskTile
          ok={!overCommitted}
          label="Capital comprometido"
          value={formatPercent(metrics.commitmentRatio)}
          hint={`Límite: ${formatPercent(metrics.maxCommitment, 0)}`}
        />
        <RiskTile
          ok={metrics.overduePaymentsAmount === 0}
          label="Pagos vencidos"
          value={formatCurrency(metrics.overduePaymentsAmount)}
          hint={`${overduePayments.length} pagos`}
        />
        <RiskTile
          ok={riskInvestors.length === 0}
          label="Inversionistas en riesgo"
          value={String(riskInvestors.length)}
          hint={`${riskOperations.length} operaciones`}
        />
      </div>

      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas del sistema</CardTitle>
          <CardDescription>Todas las alertas activas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay alertas activas.</p>
          )}
          {alerts.map((a) => {
            const style = ALERT_LEVEL[a.level] ?? ALERT_LEVEL.INFO;
            const Icon = style.icon;
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/40 p-3"
              >
                <Icon
                  className={`size-5 shrink-0 ${
                    a.level === "DANGER"
                      ? "text-[hsl(var(--danger))]"
                      : a.level === "WARNING"
                        ? "text-[hsl(var(--warning))]"
                        : "text-gold"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{a.title}</p>
                    <Badge variant={style.badge}>{a.category ?? a.level}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Exposiciones críticas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inversionistas en riesgo</CardTitle>
            <CardDescription>Requieren seguimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {riskInvestors.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin inversionistas en riesgo.</p>
            )}
            {riskInvestors.map((inv) => (
              <Link
                key={inv.id}
                href={`/inversionistas/${inv.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3 transition-colors hover:border-gold/40"
              >
                <div>
                  <p className="text-sm font-medium">{inv.fullName}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatCurrency(inv.investedCapital)} · rentab.{" "}
                    {formatPercent(inv.expectedReturn)}
                  </p>
                </div>
                <RiskBadge level={inv.riskLevel} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos vencidos</CardTitle>
            <CardDescription>Requieren cobranza</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overduePayments.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin pagos vencidos.</p>
            )}
            {overduePayments.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.investor.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Vencía el {formatDate(p.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular">{formatCurrency(p.amount)}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
            {overduePayments.length > 0 && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/pagos?estado=OVERDUE">Ver todos los pagos vencidos</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RiskTile({
  ok,
  label,
  value,
  hint,
}: {
  ok: boolean;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className={`p-5 ${ok ? "" : "border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger))]/5"}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        {ok ? (
          <ShieldCheck className="size-4 text-[hsl(var(--success))]" />
        ) : (
          <TrendingDown className="size-4 text-[hsl(var(--danger))]" />
        )}
      </div>
      <p className={`font-display text-2xl font-semibold tabular ${ok ? "" : "text-[hsl(var(--danger))]"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
