import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Coins,
  Phone,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  relativeDays,
} from "@/lib/format";
import {
  INSTALLMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  OPERATION_CATEGORY_LABELS,
  RISK_LABELS,
} from "@/lib/constants";
import { InstallmentRowActions } from "./installment-row-actions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, RiskBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperationActions } from "./operation-actions";

export const metadata: Metadata = { title: "Operación" };
export const dynamic = "force-dynamic";

export default async function OperationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const op = await db.operation.findUnique({
    where: { id },
    include: {
      responsible: { select: { id: true, name: true, role: true } },
      participants: {
        include: { investor: { select: { id: true, fullName: true } } },
      },
      movements: { orderBy: { date: "asc" } },
      installments: { orderBy: { sequence: "asc" } },
    },
  });

  if (!op) notFound();

  const isClosed = op.status === "FINISHED" || op.status === "LOSS";
  const participantsTotal = op.participants.reduce((s, p) => s + p.amount, 0);
  const companyShare = Math.max(op.capitalUsed - participantsTotal, 0);
  const expectedReturnAmount = op.capitalUsed * (1 + op.expectedReturn / 100);

  // Métricas de cobro diario (con abonos parciales)
  const installments = op.installments;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const totalToCollect = installments.reduce((s, c) => s + c.amount, 0);
  const collected = installments.reduce((s, c) => s + c.paidAmount, 0);
  const overdue = installments
    .filter((c) => c.amount - c.paidAmount > 0 && c.dueDate < startOfToday)
    .reduce((s, c) => s + (c.amount - c.paidAmount), 0);
  const pending = totalToCollect - collected;
  const paidCount = installments.filter(
    (c) => c.amount - c.paidAmount <= 0,
  ).length;
  const allPaid =
    installments.length > 0 && paidCount === installments.length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href="/operaciones">
          <ArrowLeft /> Volver a operaciones
        </Link>
      </Button>

      <PageHeader
        title={op.name}
        description={`${OPERATION_CATEGORY_LABELS[op.category] ?? op.category} · ${op.code}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={op.riskLevel} />
          <StatusBadge status={op.status} />
          {!isClosed && <OperationActions operationId={op.id} status={op.status} capitalUsed={op.capitalUsed} />}
        </div>
      </PageHeader>

      {/* Banner de resultado para operaciones cerradas */}
      {isClosed && (
        <Card
          className={
            op.status === "FINISHED"
              ? "border-emerald/30 bg-emerald/5"
              : "border-destructive/30 bg-destructive/5"
          }
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              {op.status === "FINISHED" ? (
                <CheckCircle2 className="size-6 text-[hsl(var(--success))]" />
              ) : (
                <TrendingDown className="size-6 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {op.status === "FINISHED" ? "Operación finalizada" : "Operación con pérdida"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cerrada {op.closedAt ? formatDateTime(op.closedAt) : "—"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Retorno · Utilidad
              </p>
              <p className="font-display text-lg font-semibold">
                {formatCurrency(op.returnAmount ?? 0)} ·{" "}
                <span
                  className={
                    (op.profit ?? 0) >= 0
                      ? "text-[hsl(var(--success))]"
                      : "text-destructive"
                  }
                >
                  {(op.profit ?? 0) >= 0 ? "+" : ""}
                  {formatCurrency(op.profit ?? 0)}
                </span>
              </p>
              {op.actualReturn != null && (
                <p className="text-xs text-muted-foreground">
                  Rentabilidad real: {formatPercent(op.actualReturn)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Briefcase}
          label="Capital comprometido"
          value={formatCurrency(op.capitalUsed)}
        />
        <Stat
          icon={Coins}
          label="Aporte inversionistas"
          value={formatCurrency(participantsTotal)}
          hint={`${op.participants.length} participante(s)`}
        />
        <Stat
          icon={PiggyBank}
          label="Aporte empresa"
          value={formatCurrency(companyShare)}
        />
        <Stat
          icon={TrendingUp}
          label={isClosed ? "Retorno real" : "Retorno proyectado"}
          value={formatCurrency(
            isClosed ? (op.returnAmount ?? 0) : expectedReturnAmount,
          )}
          hint={
            isClosed
              ? op.actualReturn != null
                ? `${formatPercent(op.actualReturn)} real`
                : "—"
              : `${formatPercent(op.expectedReturn)} esperado`
          }
        />
      </div>

      {/* Cobranza diaria */}
      {op.isDailyLoan && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-gold" />
              <div>
                <CardTitle>Cobranza diaria</CardTitle>
                <CardDescription>
                  {op.borrowerName ? (
                    <span className="inline-flex items-center gap-2">
                      <UserIcon className="size-3.5" /> {op.borrowerName}
                      {op.borrowerPhone && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Phone className="size-3.5" /> {op.borrowerPhone}
                        </span>
                      )}
                    </span>
                  ) : (
                    "Calendario de cuotas a cobrar."
                  )}
                </CardDescription>
              </div>
            </div>
            {allPaid && !isClosed && (
              <Badge variant="gold" className="shrink-0">
                Todo cobrado · listo para finalizar
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={Coins}
                label="Total a cobrar"
                value={formatCurrency(totalToCollect)}
                hint={`${installments.length} cuotas`}
              />
              <Stat
                icon={CheckCircle2}
                label="Cobrado"
                value={formatCurrency(collected)}
                hint={`${paidCount}/${installments.length} cuotas`}
              />
              <Stat
                icon={Wallet}
                label="Pendiente"
                value={formatCurrency(pending)}
              />
              <Stat
                icon={TrendingDown}
                label="Atrasado"
                value={formatCurrency(overdue)}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-32 text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((c) => {
                  const remaining = c.amount - c.paidAmount;
                  const fullyPaid = remaining <= 0;
                  const isOverdue = !fullyPaid && c.dueDate < startOfToday;
                  const displayStatus = isOverdue
                    ? "OVERDUE"
                    : fullyPaid
                      ? "PAID"
                      : c.paidAmount > 0
                        ? "PARTIAL"
                        : "PENDING";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">
                        {c.sequence}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p>{formatDate(c.dueDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.paidDate
                            ? `Últ. abono ${formatDate(c.paidDate)}`
                            : relativeDays(c.dueDate)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular">
                        {formatCurrency(c.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular text-[hsl(var(--success))]">
                        {c.paidAmount > 0 ? formatCurrency(c.paidAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {remaining > 0 ? formatCurrency(remaining) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={displayStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        {!isClosed && (
                          <InstallmentRowActions
                            id={c.id}
                            sequence={c.sequence}
                            amount={c.amount}
                            paidAmount={c.paidAmount}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {installments.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Sin cuotas generadas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información lateral */}
        <Card>
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info icon={Building2} label="Negocio asociado" value={op.business ?? "—"} />
            <Info
              icon={UserIcon}
              label="Responsable"
              value={op.responsible?.name ?? "Sin asignar"}
            />
            <Info
              icon={Calendar}
              label="Inicio"
              value={formatDate(op.startDate)}
            />
            <Info
              icon={Calendar}
              label="Término planificado"
              value={op.endDate ? formatDate(op.endDate) : "—"}
            />
            {op.description && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Descripción</p>
                <p className="text-sm">{op.description}</p>
              </div>
            )}
            {op.result && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Resultado / nota de cierre
                </p>
                <p className="text-sm">{op.result}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participantes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inversionistas participantes</CardTitle>
            <CardDescription>
              Aporte y retorno por inversionista (pro rata al cerrar).
            </CardDescription>
          </CardHeader>
          {op.participants.length === 0 ? (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Esta operación está financiada 100% con dinero de la empresa.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inversionista</TableHead>
                  <TableHead className="text-right">Aporte</TableHead>
                  <TableHead className="text-right">% Operación</TableHead>
                  <TableHead className="text-right">
                    {isClosed ? "Retorno" : "Esperado"}
                  </TableHead>
                  <TableHead className="text-right">Utilidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {op.participants.map((p) => {
                  const pct =
                    op.capitalUsed > 0
                      ? (p.amount / op.capitalUsed) * 100
                      : 0;
                  const projected = p.amount * (1 + op.expectedReturn / 100);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/inversionistas/${p.investor.id}`}
                          className="font-medium hover:text-gold"
                        >
                          {p.investor.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular">
                        {formatPercent(pct, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(
                          isClosed ? (p.returnAmount ?? 0) : projected,
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular ${
                          isClosed
                            ? (p.profit ?? 0) >= 0
                              ? "text-[hsl(var(--success))]"
                              : "text-destructive"
                            : "text-[hsl(var(--success))]"
                        }`}
                      >
                        {isClosed
                          ? `${(p.profit ?? 0) >= 0 ? "+" : ""}${formatCurrency(p.profit ?? 0)}`
                          : `+${formatCurrency(projected - p.amount)}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Timeline financiero */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline financiero</CardTitle>
          <CardDescription>
            Cada evento es un movimiento de capital registrado en la base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {op.movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin movimientos registrados.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {op.movements.map((m) => {
                const isReturn = m.type === "RETURN";
                const isLoss = m.type === "LOSS";
                const color = isReturn
                  ? "bg-[hsl(var(--success))]"
                  : isLoss
                    ? "bg-destructive"
                    : "bg-gold";
                return (
                  <li key={m.id} className="relative">
                    <span
                      className={`absolute -left-[31px] mt-1 size-3 rounded-full ${color} ring-4 ring-background`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.description ?? "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-medium tabular ${
                            isReturn
                              ? "text-[hsl(var(--success))]"
                              : isLoss
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {isLoss ? "−" : isReturn ? "+" : ""}
                          {formatCurrency(m.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(m.date)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-gold/10 text-gold">
        <Icon className="size-5" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
