import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCapitalGrowth } from "@/lib/data/metrics";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CapitalGrowthChart, PaymentsBarChart } from "@/components/dashboard/charts";
import { INVESTOR_STATUS_LABELS, OPERATION_STATUS_LABELS, RISK_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Estadísticas" };
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [growth, investorByStatus, opByStatus, byRisk, contracts] =
    await Promise.all([
      getCapitalGrowth(12),
      db.investor.groupBy({ by: ["status"], _count: true, _sum: { investedCapital: true } }),
      db.operation.groupBy({ by: ["status"], _count: true, _sum: { capitalUsed: true } }),
      db.investor.groupBy({ by: ["riskLevel"], _count: true, _sum: { investedCapital: true } }),
      db.contract.findMany(),
    ]);

  const avgTicket =
    investorByStatus.reduce((s, g) => s + (g._sum.investedCapital ?? 0), 0) /
    Math.max(
      investorByStatus.reduce((s, g) => s + g._count, 0),
      1,
    );

  const avgRate =
    contracts.length > 0
      ? contracts.reduce((s, c) => s + c.returnRate, 0) / contracts.length
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estadísticas"
        description="Indicadores agregados de la cartera, capital y rendimiento."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Ticket promedio" value={formatCurrency(avgTicket)} />
        <Tile label="Rentabilidad media contratos" value={formatPercent(avgRate)} />
        <Tile label="Contratos totales" value={String(contracts.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crecimiento de capital · 12 meses</CardTitle>
          <CardDescription>Evolución acumulada del capital administrado</CardDescription>
        </CardHeader>
        <CardContent>
          <CapitalGrowthChart data={growth} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <DistroCard
          title="Inversionistas por estado"
          rows={investorByStatus.map((g) => ({
            label: INVESTOR_STATUS_LABELS[g.status] ?? g.status,
            count: g._count,
            sum: g._sum.investedCapital ?? 0,
          }))}
        />
        <DistroCard
          title="Operaciones por estado"
          rows={opByStatus.map((g) => ({
            label: OPERATION_STATUS_LABELS[g.status] ?? g.status,
            count: g._count,
            sum: g._sum.capitalUsed ?? 0,
          }))}
        />
        <DistroCard
          title="Concentración por riesgo"
          rows={byRisk.map((g) => ({
            label: RISK_LABELS[g.riskLevel] ?? g.riskLevel,
            count: g._count,
            sum: g._sum.investedCapital ?? 0,
          }))}
        />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular">{value}</p>
    </div>
  );
}

function DistroCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; sum: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.sum, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const pct = total > 0 ? (r.sum / total) * 100 : 0;
          return (
            <div key={r.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{r.label}</span>
                <span className="text-muted-foreground">{r.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular">
                {formatCurrency(r.sum)}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
