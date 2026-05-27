import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getMonthlyFlow } from "@/lib/data/metrics";
import { formatCurrency, formatDate } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FlowAreaChart } from "@/components/dashboard/charts";

export const metadata: Metadata = { title: "Flujo financiero" };
export const dynamic = "force-dynamic";

export default async function FlowPage() {
  const [flow, movements] = await Promise.all([
    getMonthlyFlow(12),
    db.capitalMovement.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  const totalIn = flow.reduce((s, m) => s + m.ingresos, 0);
  const totalOut = flow.reduce((s, m) => s + m.egresos, 0);
  const net = totalIn - totalOut;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flujo financiero"
        description="Análisis detallado de ingresos, egresos y resultado neto del período."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ingresos · 12m" value={formatCurrency(totalIn)} positive />
        <Stat label="Egresos · 12m" value={formatCurrency(totalOut)} />
        <Stat label="Resultado neto" value={formatCurrency(net)} positive={net >= 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flujo mensual</CardTitle>
          <CardDescription>Ingresos vs. egresos · últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <FlowAreaChart data={flow} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Wallet className="size-5 text-gold" />
          <div>
            <CardTitle>Movimientos recientes</CardTitle>
            <CardDescription>Últimos 30 movimientos de capital</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {movements.map((m) => {
            const positive = m.type === "INFLOW" || m.type === "RETURN";
            return (
              <div
                key={m.id}
                className="flex items-center justify-between border-b border-border/40 py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      positive
                        ? "bg-emerald/10 text-[hsl(var(--success))]"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {positive ? (
                      <ArrowDownRight className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.description ?? m.category ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-medium tabular ${
                      positive
                        ? "text-[hsl(var(--success))]"
                        : "text-foreground"
                    }`}
                  >
                    {positive ? "+" : "-"}
                    {formatCurrency(m.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(m.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-semibold tabular ${
          positive ? "text-[hsl(var(--success))]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
