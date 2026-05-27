import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PaymentsBarChart } from "@/components/dashboard/charts";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Reportes de pagos" };
export const dynamic = "force-dynamic";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default async function PaymentReportsPage() {
  const payments = await db.payment.findMany();

  // Distribución por estado
  const byStatus = Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => ({
    key,
    label,
    value: payments.filter((p) => p.status === key).reduce((s, p) => s + p.amount, 0),
  }));

  // Pagos por mes (últimos 6)
  const now = new Date();
  const monthly: { month: string; pagado: number; vencido: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const pagado = payments
      .filter((p) => p.paidDate && `${new Date(p.paidDate).getFullYear()}-${new Date(p.paidDate).getMonth()}` === key)
      .reduce((s, p) => s + p.amount, 0);
    const vencido = payments
      .filter((p) => p.status === "OVERDUE" && `${new Date(p.dueDate).getFullYear()}-${new Date(p.dueDate).getMonth()}` === key)
      .reduce((s, p) => s + p.amount, 0);
    monthly.push({ month: MONTHS[d.getMonth()], pagado, vencido });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes de pagos"
        description="Análisis del comportamiento de pagos, mora y proyecciones."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por estado</CardTitle>
            <CardDescription>Monto agregado por estado de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentsBarChart data={byStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen agregado</CardTitle>
            <CardDescription>Totales del histórico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byStatus.map((s) => (
              <div key={s.key} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <span className="font-medium tabular">{formatCurrency(s.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos por mes</CardTitle>
          <CardDescription>Pagados vs. vencidos en los últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3 text-center">
            {monthly.map((m) => (
              <div key={m.month} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{m.month}</p>
                <p className="mt-1 text-sm font-medium tabular text-[hsl(var(--success))]">
                  {formatCurrency(m.pagado)}
                </p>
                {m.vencido > 0 && (
                  <p className="text-xs text-[hsl(var(--danger))] tabular">
                    -{formatCurrency(m.vencido)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
