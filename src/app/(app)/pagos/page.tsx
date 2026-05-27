import type { Metadata } from "next";
import Link from "next/link";
import {
  Wallet,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, relativeDays } from "@/lib/format";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentRowActions } from "./payment-row-actions";

export const metadata: Metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const where = estado ? { status: estado } : {};

  const [payments, all, counts] = await Promise.all([
    db.payment.findMany({
      where,
      include: { investor: true, contract: true },
      orderBy: { dueDate: "desc" },
      take: 200,
    }),
    db.payment.findMany(),
    db.payment.groupBy({ by: ["status"], _count: true }),
  ]);

  const sumOf = (status: string) =>
    all.filter((p) => p.status === status).reduce((s, p) => s + p.amount, 0);
  const countOf = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos"
        description="Registro y seguimiento de pagos, intereses y devoluciones de capital."
      >
        <Button asChild variant="outline">
          <Link href="/pagos/reportes">Ver reportes</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pagados (histórico)"
          value={formatCurrency(sumOf("PAID"))}
          icon={CheckCircle2}
          accent="emerald"
          hint={`${countOf("PAID")} pagos`}
        />
        <KpiCard
          label="Pendientes"
          value={formatCurrency(sumOf("PENDING"))}
          icon={CalendarClock}
          accent="gold"
          hint={`${countOf("PENDING")} pagos`}
        />
        <KpiCard
          label="Vencidos"
          value={formatCurrency(sumOf("OVERDUE"))}
          icon={AlertCircle}
          accent="danger"
          hint={`${countOf("OVERDUE")} pagos`}
        />
        <KpiCard
          label="Programados"
          value={formatCurrency(sumOf("SCHEDULED"))}
          icon={Wallet}
          accent="neutral"
          hint={`${countOf("SCHEDULED")} pagos`}
        />
      </div>

      <FilterTabs
        tabs={[
          { label: "Todos", value: null, count: counts.reduce((s, c) => s + c._count, 0) },
          ...Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => ({
            label: v,
            value: k,
            count: countOf(k),
          })),
        ]}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inversionista</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/inversionistas/${p.investorId}`}
                    className="font-medium hover:text-gold"
                  >
                    {p.investor.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                </TableCell>
                <TableCell className="text-right font-medium tabular">
                  {formatCurrency(p.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <p>{formatDate(p.dueDate)}</p>
                  <p className="text-xs">{relativeDays(p.dueDate)}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.paidDate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.contract ? (
                    <Link href={`/contratos/${p.contractId}`} className="hover:text-gold">
                      {p.contract.code}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell>
                  <PaymentRowActions id={p.id} paid={p.status === "PAID"} />
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No hay pagos en este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
