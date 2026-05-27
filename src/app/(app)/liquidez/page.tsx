import type { Metadata } from "next";
import {
  Droplets,
  PiggyBank,
  Briefcase,
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  Calculator,
} from "lucide-react";
import { db } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/data/metrics";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LiquidityDonut } from "@/components/dashboard/charts";
import { LiquiditySimulator } from "./simulator";

export const metadata: Metadata = { title: "Control de liquidez" };
export const dynamic = "force-dynamic";

export default async function LiquidityPage() {
  const [metrics, movements] = await Promise.all([
    getDashboardMetrics(),
    db.capitalMovement.findMany({
      orderBy: { date: "desc" },
      take: 12,
      include: { operation: true },
    }),
  ]);

  const liquidityLow = metrics.availableLiquidity < metrics.minLiquidity;
  const overCommitted = metrics.commitmentRatio > metrics.maxCommitment;
  const reserveOk = metrics.reserves > 0;

  const donut = [
    { name: "Capital trabajando", value: metrics.capitalWorking, color: "hsl(43, 70%, 55%)" },
    { name: "Reservas", value: metrics.reserves, color: "hsl(158, 64%, 45%)" },
    { name: "Liquidez disponible", value: Math.max(metrics.availableLiquidity, 0), color: "hsl(222, 14%, 28%)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control de liquidez"
        description="Gestión profesional del capital disponible, reservas, capital comprometido y márgenes de seguridad."
      >
        <Badge variant={liquidityLow || overCommitted ? "danger" : "success"}>
          {liquidityLow || overCommitted ? "Atención requerida" : "Liquidez saludable"}
        </Badge>
      </PageHeader>

      {/* Indicadores principales */}
      <div className="grid gap-4 lg:grid-cols-4">
        <MetricTile
          icon={Droplets}
          label="Liquidez disponible"
          value={formatCurrency(metrics.availableLiquidity)}
          progress={Math.max(metrics.liquidityRatio, 0)}
          accent={liquidityLow ? "danger" : "emerald"}
          hint={`${formatPercent(metrics.liquidityRatio)} del capital total`}
        />
        <MetricTile
          icon={Briefcase}
          label="Capital comprometido"
          value={formatCurrency(metrics.capitalWorking)}
          progress={metrics.commitmentRatio}
          accent={overCommitted ? "danger" : "gold"}
          hint={`Límite: ${formatPercent(metrics.maxCommitment, 0)}`}
        />
        <MetricTile
          icon={PiggyBank}
          label="Reservas"
          value={formatCurrency(metrics.reserves)}
          progress={metrics.reservePercentage}
          accent="gold"
          hint={`Política: ${formatPercent(metrics.reservePercentage, 0)} del capital`}
        />
        <MetricTile
          icon={ShieldCheck}
          label="Liquidez mínima exigida"
          value={formatCurrency(metrics.minLiquidity)}
          progress={Math.min(
            (metrics.availableLiquidity / Math.max(metrics.minLiquidity, 1)) * 100,
            100,
          )}
          accent={liquidityLow ? "danger" : "emerald"}
          hint={liquidityLow ? "Por debajo del mínimo" : "Sobre el mínimo"}
        />
      </div>

      {/* Alertas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AlertTile
          ok={!liquidityLow}
          icon={Droplets}
          title="Liquidez"
          okMsg="La liquidez disponible está sobre el mínimo exigido."
          alertMsg="La liquidez disponible está por debajo del mínimo. Evita comprometer nuevo capital."
        />
        <AlertTile
          ok={!overCommitted}
          icon={Briefcase}
          title="Capital comprometido"
          okMsg={`${formatPercent(metrics.commitmentRatio)} comprometido — dentro del límite.`}
          alertMsg={`${formatPercent(metrics.commitmentRatio)} comprometido — supera el límite de ${formatPercent(metrics.maxCommitment, 0)}.`}
        />
        <AlertTile
          ok={reserveOk}
          icon={PiggyBank}
          title="Reservas"
          okMsg={`Se mantiene una reserva del ${formatPercent(metrics.reservePercentage, 0)} del capital.`}
          alertMsg="No se ha configurado un porcentaje de reserva."
        />
      </div>

      {/* Composición + simulador */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Composición del capital</CardTitle>
            <CardDescription>Distribución actual del capital administrado</CardDescription>
          </CardHeader>
          <CardContent>
            <LiquidityDonut data={donut} />
            <div className="mt-4 space-y-2">
              {donut.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-medium tabular">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-2">
            <Calculator className="size-5 text-gold" />
            <div>
              <CardTitle>Simulador de liquidez</CardTitle>
              <CardDescription>
                Evalúa el impacto de comprometer capital adicional o liberar reservas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <LiquiditySimulator
              totalCapital={metrics.totalCapital}
              capitalWorking={metrics.capitalWorking}
              reserves={metrics.reserves}
              minLiquidity={metrics.minLiquidity}
              maxCommitment={metrics.maxCommitment}
            />
          </CardContent>
        </Card>
      </div>

      {/* Últimos movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos de capital</CardTitle>
          <CardDescription>Ingresos, egresos, reservas y compromisos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-secondary/40"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-9 items-center justify-center rounded-lg ${
                    m.type === "INFLOW" || m.type === "RETURN"
                      ? "bg-emerald/10 text-[hsl(var(--success))]"
                      : m.type === "RESERVE"
                        ? "bg-gold/10 text-gold"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {m.type === "INFLOW" || m.type === "RETURN" ? (
                    <Droplets className="size-4" />
                  ) : m.type === "RESERVE" ? (
                    <PiggyBank className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.description ?? m.category ?? "—"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium tabular">{formatCurrency(m.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p>
              </div>
            </div>
          ))}
          {movements.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay movimientos registrados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  progress,
  accent,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  progress: number;
  accent: "gold" | "emerald" | "danger";
  hint: string;
}) {
  const colors: Record<string, string> = {
    gold: "bg-gold",
    emerald: "bg-emerald",
    danger: "bg-[hsl(var(--danger))]",
  };
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <Icon className="size-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground tabular">
          {formatPercent(progress, 0)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular">{value}</p>
      <Progress
        value={Math.min(Math.max(progress, 0), 100)}
        className="mt-3"
        indicatorClassName={colors[accent]}
      />
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function AlertTile({
  ok,
  icon: Icon,
  title,
  okMsg,
  alertMsg,
}: {
  ok: boolean;
  icon: any;
  title: string;
  okMsg: string;
  alertMsg: string;
}) {
  return (
    <Card
      className={`p-4 ${ok ? "" : "border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger))]/5"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        {ok ? (
          <ShieldCheck className="size-4 text-[hsl(var(--success))]" />
        ) : (
          <AlertTriangle className="size-4 text-[hsl(var(--danger))]" />
        )}
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className={`text-xs ${ok ? "text-muted-foreground" : "text-[hsl(var(--danger))]"}`}>
        {ok ? okMsg : alertMsg}
      </p>
    </Card>
  );
}
