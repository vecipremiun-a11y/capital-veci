import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Rendimiento de operaciones" };
export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const ops = await db.operation.findMany({ orderBy: { startDate: "desc" } });

  const finished = ops.filter((o) => o.status === "FINISHED");
  const realized = finished.reduce(
    (s, o) => s + o.capitalUsed * ((o.actualReturn ?? o.expectedReturn) / 100),
    0,
  );
  const totalCapital = ops.reduce((s, o) => s + o.capitalUsed, 0);
  const blendedReturn =
    totalCapital > 0
      ? ops.reduce(
          (s, o) => s + o.capitalUsed * (o.expectedReturn / 100),
          0,
        ) / totalCapital * 100
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rendimiento de operaciones"
        description="Comparación entre rentabilidad esperada y real de cada operación."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Operaciones finalizadas" value={String(finished.length)} />
        <Stat label="Utilidad realizada" value={formatCurrency(realized)} />
        <Stat label="Rentabilidad ponderada" value={formatPercent(blendedReturn)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Operación</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Esperada</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead>Desviación</TableHead>
              <TableHead>Riesgo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ops.map((o) => {
              const diff = (o.actualReturn ?? o.expectedReturn) - o.expectedReturn;
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{o.name}</TableCell>
                  <TableCell className="text-right tabular">
                    {formatCurrency(o.capitalUsed)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatPercent(o.expectedReturn)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {o.actualReturn != null ? formatPercent(o.actualReturn) : "—"}
                  </TableCell>
                  <TableCell
                    className={`tabular ${
                      diff > 0
                        ? "text-[hsl(var(--success))]"
                        : diff < 0
                          ? "text-[hsl(var(--danger))]"
                          : "text-muted-foreground"
                    }`}
                  >
                    {o.actualReturn != null
                      ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pp`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <RiskBadge level={o.riskLevel} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular">{value}</p>
    </div>
  );
}
