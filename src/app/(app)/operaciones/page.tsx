import type { Metadata } from "next";
import Link from "next/link";
import {
  Briefcase,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  PiggyBank,
  Coins,
} from "lucide-react";
import { db } from "@/lib/db";
import { getOperationsMetrics } from "@/lib/data/metrics";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import {
  OPERATION_CATEGORY_LABELS,
  OPERATION_STATUS_LABELS,
} from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const [operations, all, metrics] = await Promise.all([
    db.operation.findMany({
      where,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      include: {
        participants: { select: { amount: true } },
        responsible: { select: { name: true } },
      },
    }),
    db.operation.findMany({ select: { id: true, status: true } }),
    getOperationsMetrics(),
  ]);

  const countOf = (s: string) =>
    all.filter((o) => o.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones comerciales"
        description="Negocios y operaciones donde se invierte el capital administrado. Cada operación mueve dinero entre liquidez y capital comprometido."
      >
        <Button asChild variant="gold">
          <Link href="/operaciones/nuevo">
            <Plus /> Nueva operación
          </Link>
        </Button>
      </PageHeader>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Capital trabajando"
          value={formatCurrency(metrics.capitalWorking)}
          icon={Briefcase}
          accent="gold"
          hint={`${metrics.activeCount} activa(s)`}
        />
        <KpiCard
          label="Utilidad acumulada"
          value={formatCurrency(metrics.totalProfit)}
          icon={TrendingUp}
          accent="emerald"
          hint={
            metrics.avgActualReturn !== 0
              ? `${formatPercent(metrics.avgActualReturn)} prom. real`
              : "Sin cierres aún"
          }
        />
        <KpiCard
          label="Pérdidas registradas"
          value={formatCurrency(metrics.totalLoss)}
          icon={AlertTriangle}
          accent={metrics.totalLoss > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          label="Operaciones en riesgo"
          value={String(metrics.riskCount)}
          icon={AlertTriangle}
          accent={metrics.riskCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Composición del capital trabajando */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Composición del capital trabajando
          </CardTitle>
          <CardDescription>
            Cuánto del capital comprometido es dinero de la empresa y cuánto es
            aporte directo de inversionistas en estas operaciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <SplitTile
              icon={PiggyBank}
              label="Dinero de la empresa"
              value={metrics.companyMoneyWorking}
              total={metrics.capitalWorking}
              color="bg-gold"
            />
            <SplitTile
              icon={Coins}
              label="Aporte de inversionistas"
              value={metrics.investorMoneyWorking}
              total={metrics.capitalWorking}
              color="bg-emerald"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filtros por estado */}
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

      {/* Lista */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {operations.map((o) => {
          const progress = computeProgress(o.startDate, o.endDate);
          const partSum = o.participants.reduce((s, p) => s + p.amount, 0);
          const isClosed = o.status === "FINISHED" || o.status === "LOSS";
          return (
            <Link
              key={o.id}
              href={`/operaciones/${o.id}`}
              className="block transition-transform hover:scale-[1.01]"
            >
              <Card className="flex h-full flex-col hover:border-gold/40">
                <CardHeader>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {OPERATION_CATEGORY_LABELS[o.category] ?? o.category}
                      </Badge>
                      <span className="text-xs font-medium tabular text-muted-foreground">
                        {o.code}
                      </span>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <CardTitle className="text-base">{o.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {o.business ? `${o.business} · ` : ""}
                    {o.description ?? "Sin descripción"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Capital</span>
                    <span className="font-medium tabular">
                      {formatCurrency(o.capitalUsed)}
                    </span>
                  </div>
                  {partSum > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Aporte inversionistas
                      </span>
                      <span className="font-medium text-emerald tabular">
                        {formatCurrency(partSum)}
                      </span>
                    </div>
                  )}
                  {isClosed ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {o.status === "LOSS" ? "Pérdida" : "Utilidad"}
                      </span>
                      <span
                        className={`font-semibold tabular ${
                          (o.profit ?? 0) >= 0
                            ? "text-[hsl(var(--success))]"
                            : "text-destructive"
                        }`}
                      >
                        {(o.profit ?? 0) >= 0 ? "+" : ""}
                        {formatCurrency(o.profit ?? 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Retorno esperado
                      </span>
                      <span className="font-medium text-[hsl(var(--success))] tabular">
                        {formatPercent(o.expectedReturn)}
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
                        o.status === "LOSS"
                          ? "bg-destructive"
                          : o.status === "RISK"
                            ? "bg-[hsl(var(--danger))]"
                            : o.status === "FINISHED"
                              ? "bg-emerald"
                              : o.status === "PAUSED"
                                ? "bg-[hsl(var(--warning))]"
                                : "bg-gold"
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <RiskBadge level={o.riskLevel} />
                    {o.responsible && (
                      <span className="text-xs text-muted-foreground">
                        {o.responsible.name}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {operations.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay operaciones en este filtro.{" "}
              <Link
                href="/operaciones/nuevo"
                className="text-gold hover:underline"
              >
                Crear la primera →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SplitTile({
  icon: Icon,
  label,
  value,
  total,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular">
          {pct.toFixed(1)}%
        </span>
      </div>
      <p className="font-display text-xl font-semibold tabular">
        {formatCurrency(value)}
      </p>
      <Progress value={pct} indicatorClassName={color} />
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
