import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  AlertCircle,
  Coins,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, relativeDays } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstallmentRowActions } from "../[id]/installment-row-actions";

export const metadata: Metadata = { title: "Cobros del día" };
export const dynamic = "force-dynamic";

// f = hoy | atrasados | proximos | (default: por cobrar = atrasados + hoy)
export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);

  // Solo cuotas no cobradas de operaciones de préstamo con cobro diario.
  const baseWhere = {
    status: { not: "PAID" },
    operation: {
      isDailyLoan: true,
      status: { in: ["ACTIVE", "PAUSED", "RISK"] },
    },
  };

  let where: Record<string, unknown> = { ...baseWhere };
  if (f === "hoy") {
    where = { ...baseWhere, dueDate: { gte: startOfToday, lte: endOfToday } };
  } else if (f === "atrasados") {
    where = { ...baseWhere, dueDate: { lt: startOfToday } };
  } else if (f === "proximos") {
    where = { ...baseWhere, dueDate: { gt: endOfToday } };
  } else {
    // Por cobrar (default): todo lo vencido + lo de hoy
    where = { ...baseWhere, dueDate: { lte: endOfToday } };
  }

  const [rows, pendingAll] = await Promise.all([
    db.loanInstallment.findMany({
      where,
      include: {
        operation: {
          select: { id: true, name: true, code: true, borrowerName: true, borrowerPhone: true },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 300,
    }),
    db.loanInstallment.findMany({
      where: baseWhere,
      select: { amount: true, paidAmount: true, dueDate: true, operationId: true },
    }),
  ]);

  const rem = (c: { amount: number; paidAmount: number }) =>
    Math.max(c.amount - c.paidAmount, 0);

  const todayTotal = pendingAll
    .filter((c) => c.dueDate >= startOfToday && c.dueDate <= endOfToday)
    .reduce((s, c) => s + rem(c), 0);
  const overdueTotal = pendingAll
    .filter((c) => c.dueDate < startOfToday)
    .reduce((s, c) => s + rem(c), 0);
  const peopleToday = new Set(
    pendingAll
      .filter((c) => c.dueDate <= endOfToday)
      .map((c) => c.operationId),
  ).size;

  const countWhere = async (w: Record<string, unknown>) =>
    db.loanInstallment.count({ where: w });
  const [cToday, cOverdue, cNext, cDue] = await Promise.all([
    countWhere({ ...baseWhere, dueDate: { gte: startOfToday, lte: endOfToday } }),
    countWhere({ ...baseWhere, dueDate: { lt: startOfToday } }),
    countWhere({ ...baseWhere, dueDate: { gt: endOfToday } }),
    countWhere({ ...baseWhere, dueDate: { lte: endOfToday } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobros del día"
        description="Personas a las que hay que cobrar hoy en los préstamos con cobro diario."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="A cobrar hoy"
          value={formatCurrency(todayTotal)}
          icon={Coins}
          accent="gold"
          hint={`${cToday} cuotas hoy`}
        />
        <KpiCard
          label="Atrasado acumulado"
          value={formatCurrency(overdueTotal)}
          icon={AlertCircle}
          accent="danger"
          hint={`${cOverdue} cuotas vencidas`}
        />
        <KpiCard
          label="Personas por cobrar"
          value={`${peopleToday}`}
          icon={Users}
          accent="neutral"
          hint="Deudores con cuota pendiente"
        />
      </div>

      <FilterTabs
        tabs={[
          { label: "Por cobrar", value: null, count: cDue },
          { label: "Hoy", value: "hoy", count: cToday },
          { label: "Atrasados", value: "atrasados", count: cOverdue },
          { label: "Próximos", value: "proximos", count: cNext },
        ]}
        param="f"
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deudor</TableHead>
              <TableHead>Operación</TableHead>
              <TableHead>Cuota</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-28 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const remaining = Math.max(c.amount - c.paidAmount, 0);
              const isOverdue = c.dueDate < startOfToday;
              const status = isOverdue
                ? "OVERDUE"
                : c.paidAmount > 0
                  ? "PARTIAL"
                  : "PENDING";
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium">
                      {c.operation.borrowerName ?? c.operation.name}
                    </p>
                    {c.operation.borrowerPhone && (
                      <p className="text-xs text-muted-foreground">
                        {c.operation.borrowerPhone}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link
                      href={`/operaciones/${c.operation.id}`}
                      className="hover:text-gold"
                    >
                      {c.operation.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    #{c.sequence}
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{formatDate(c.dueDate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {relativeDays(c.dueDate)}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">
                    {formatCurrency(remaining)}
                    {c.paidAmount > 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        de {formatCurrency(c.amount)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <InstallmentRowActions
                      id={c.id}
                      sequence={c.sequence}
                      amount={c.amount}
                      paidAmount={c.paidAmount}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  No hay cobros pendientes en este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
