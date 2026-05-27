import type { Metadata } from "next";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Wallet,
  Droplets,
  Users,
  Briefcase,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  getDashboardMetrics,
  getMonthlyFlow,
  getCapitalGrowth,
} from "@/lib/data/metrics";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CapitalGrowthChart,
  FlowAreaChart,
} from "@/components/dashboard/charts";

export const metadata: Metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

const REPORTS = [
  { title: "Utilidades del período", icon: TrendingUp, desc: "Resumen de intereses pagados y retornos realizados." },
  { title: "Liquidez y reservas", icon: Droplets, desc: "Estado de la liquidez disponible y reservas configuradas." },
  { title: "Pagos por inversionista", icon: Wallet, desc: "Detalle de pagos realizados, pendientes y vencidos." },
  { title: "Capital administrado", icon: Users, desc: "Evolución mensual del capital aportado y bajo gestión." },
  { title: "Rendimiento de operaciones", icon: Briefcase, desc: "Comparativa entre rentabilidad esperada y real." },
  { title: "Crecimiento histórico", icon: BarChart3, desc: "Análisis del crecimiento mensual y anual del capital." },
];

export default async function ReportsPage() {
  const [metrics, flow, growth, investorsTop] = await Promise.all([
    getDashboardMetrics(),
    getMonthlyFlow(6),
    getCapitalGrowth(8),
    db.investor.findMany({
      where: { status: "ACTIVE" },
      orderBy: { investedCapital: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Reportes profesionales en PDF y Excel para gestión, auditoría y comunicación a inversionistas."
      >
        <Button variant="outline">
          <FileSpreadsheet /> Exportar Excel
        </Button>
        <Button variant="gold">
          <FileText /> Generar PDF mensual
        </Button>
      </PageHeader>

      {/* Resumen ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen ejecutivo</CardTitle>
          <CardDescription>
            Indicadores principales para reporte mensual
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Box label="Capital administrado" value={formatCurrency(metrics.totalCapital)} />
          <Box label="Liquidez disponible" value={formatCurrency(metrics.availableLiquidity)} />
          <Box label="Capital trabajando" value={formatCurrency(metrics.capitalWorking)} />
          <Box label="Rentabilidad mensual" value={formatCurrency(metrics.monthlyReturn)} />
          <Box label="Inversionistas activos" value={String(metrics.activeInvestors)} />
          <Box label="Operaciones activas" value={String(metrics.activeOperations)} />
          <Box label="% liquidez" value={formatPercent(metrics.liquidityRatio)} />
          <Box label="% comprometido" value={formatPercent(metrics.commitmentRatio)} />
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crecimiento de capital</CardTitle>
            <CardDescription>Últimos 8 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <CapitalGrowthChart data={growth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Flujo financiero</CardTitle>
            <CardDescription>Ingresos vs. egresos · 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <FlowAreaChart data={flow} />
          </CardContent>
        </Card>
      </div>

      {/* Top inversionistas */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 inversionistas</CardTitle>
          <CardDescription>Por capital invertido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {investorsTop.map((inv, idx) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-gold/10 text-sm font-semibold text-gold">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{inv.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Rentab. pactada {formatPercent(inv.expectedReturn)}
                  </p>
                </div>
              </div>
              <span className="font-medium tabular">
                {formatCurrency(inv.investedCapital)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Catálogo de reportes */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Catálogo de reportes</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <Card key={r.title} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <r.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{r.title}</CardTitle>
                <CardDescription>{r.desc}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <FileSpreadsheet /> Excel
                </Button>
                <Button variant="gold" size="sm" className="flex-1">
                  <FileText /> PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
