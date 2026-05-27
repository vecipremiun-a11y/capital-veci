import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { OPERATION_STATUS_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "Operaciones" };
export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const where = estado ? { status: estado } : {};

  const [operations, all, counts] = await Promise.all([
    db.operation.findMany({ where, orderBy: { startDate: "desc" } }),
    db.operation.findMany(),
    db.operation.groupBy({ by: ["status"], _count: true }),
  ]);

  const countOf = (s: string) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  const totalCapital = all.reduce((s, o) => s + o.capitalUsed, 0);
  const activeCapital = all
    .filter((o) => o.status === "ACTIVE")
    .reduce((s, o) => s + o.capitalUsed, 0);
  const avgReturn =
    all.length > 0
      ? all.reduce((s, o) => s + o.expectedReturn, 0) / all.length
      : 0;
  const riskCount = countOf("RISK");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones comerciales"
        description="Negocios y operaciones donde se invierte el capital administrado."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Capital invertido"
          value={formatCurrency(totalCapital)}
          icon={Briefcase}
          accent="gold"
        />
        <KpiCard
          label="En operaciones activas"
          value={formatCurrency(activeCapital)}
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          label="Rentabilidad media"
          value={formatPercent(avgReturn)}
          icon={TrendingUp}
          accent="emerald"
        />
        <KpiCard
          label="Operaciones en riesgo"
          value={String(riskCount)}
          icon={AlertTriangle}
          accent={riskCount > 0 ? "danger" : "neutral"}
        />
      </div>

      <FilterTabs
        tabs={[
          { label: "Todas", value: null, count: all.length },
          ...Object.entries(OPERATION_STATUS_LABELS).map(([k, v]) => ({
            label: v,
            value: k,
            count: countOf(k),
          })),
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {operations.map((o) => {
          const progress = computeProgress(o.startDate, o.endDate);
          return (
            <Card key={o.id} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-xs font-medium tabular text-muted-foreground">
                    {o.code}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
                <CardTitle className="text-base">{o.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {o.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capital</span>
                  <span className="font-medium tabular">
                    {formatCurrency(o.capitalUsed)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rentabilidad esperada</span>
                  <span className="font-medium text-[hsl(var(--success))] tabular">
                    {formatPercent(o.expectedReturn)}
                  </span>
                </div>
                {o.actualReturn != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Rentabilidad real</span>
                    <span className="font-medium text-gold tabular">
                      {formatPercent(o.actualReturn)}
                    </span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avance</span>
                    <span>{formatDate(o.endDate ?? new Date())}</span>
                  </div>
                  <Progress
                    value={progress}
                    indicatorClassName={
                      o.status === "RISK"
                        ? "bg-[hsl(var(--danger))]"
                        : o.status === "FINISHED"
                          ? "bg-emerald"
                          : "bg-gold"
                    }
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <RiskBadge level={o.riskLevel} />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {operations.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay operaciones en este filtro.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function computeProgress(start: Date | string, end: Date | string | null): number {
  if (!end) return 50;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}
