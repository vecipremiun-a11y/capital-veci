import Link from "next/link";
import {
  HandCoins,
  Briefcase,
  Wallet,
  Clock,
  Target,
  Coins,
} from "lucide-react";
import type {
  getStaffMemberCapital,
  getStaffLedger,
} from "@/lib/data/staff-capital";
import { STAFF_ASSIGNMENT_TYPE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DeleteAssignmentButton } from "./delete-assignment-button";
import { ActivityHistory } from "./activity-history";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StaffData = NonNullable<Awaited<ReturnType<typeof getStaffMemberCapital>>>;
type Ledger = Awaited<ReturnType<typeof getStaffLedger>>;

/**
 * Panel de caja de un trabajador. Lo comparten la vista de admin
 * (/trabajadores/[id]) y la vista propia del trabajador (/mi-caja).
 */
export function StaffCashPanel({
  data,
  ledger,
  showRole = true,
  canDelete = false,
}: {
  data: StaffData;
  ledger: Ledger;
  showRole?: boolean;
  /** Solo el admin puede borrar movimientos de caja. */
  canDelete?: boolean;
}) {
  const { capital, assignments, operations } = data;
  const { split } = ledger;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Capital entregado"
          value={formatCurrency(capital.assigned)}
          icon={HandCoins}
          accent="gold"
          hint={
            capital.returned > 0
              ? `${formatCurrency(capital.handedOut)} entregado − ${formatCurrency(capital.returned)} devuelto`
              : `${assignments.length} movimientos`
          }
        />
        <KpiCard
          label="Colocado en préstamos"
          value={formatCurrency(capital.working)}
          icon={Briefcase}
          hint={`${capital.liveOperations} operaciones vigentes`}
        />
        <KpiCard
          label="Monto esperado"
          value={formatCurrency(capital.expected)}
          icon={Target}
          hint={`${formatCurrency(capital.working)} colocados + ${formatCurrency(capital.expected - capital.working)} de interés`}
        />
        <KpiCard
          label="Por cobrar"
          value={formatCurrency(capital.toCollect)}
          icon={Clock}
          hint="Capital + interés pendiente"
        />
        <KpiCard
          label="Efectivo en mano"
          value={formatCurrency(capital.available)}
          icon={Wallet}
          accent={capital.available < 0 ? "danger" : "emerald"}
          hint="Disponible para prestar"
        />
      </div>

      {/* De qué está hecho ese efectivo */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              <Coins className="size-4 text-[hsl(var(--success))]" />
              <span className="font-medium">Cobranza disponible</span>
            </span>
            <span className="font-display text-lg font-semibold tabular text-[hsl(var(--success))]">
              {formatCurrency(split.fromCollections)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Plata que volvió de los cobros y todavía no se vuelve a prestar. Es
            lo primero que se usa al colocar un préstamo nuevo.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              <HandCoins className="size-4 text-gold" />
              <span className="font-medium">Capital sin colocar</span>
            </span>
            <span
              className={
                split.fromCapital < 0
                  ? "font-display text-lg font-semibold tabular text-[hsl(var(--danger))]"
                  : "font-display text-lg font-semibold tabular text-gold"
              }
            >
              {formatCurrency(split.fromCapital)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lo que queda del capital que le entregó la empresa. Se usa recién
            cuando la cobranza no alcanza.
          </p>
        </div>
      </div>

      <ActivityHistory activity={ledger.activity} />

      {capital.available < 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          El efectivo en mano salió negativo: hay más plata colocada que
          entregada. Revisa si falta registrar una entrega de capital o si hay
          préstamos asignados a este trabajador que en realidad financió la
          empresa.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Historial de caja */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de caja</CardTitle>
            <CardDescription>
              Entregas de la empresa y devoluciones
              {showRole && ` · ${ROLE_LABELS[capital.role] ?? capital.role}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {assignments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Todavía no hay entregas registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Movimiento</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      {canDelete && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(a.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={a.type === "ASSIGN" ? "gold" : "muted"}
                          >
                            {STAFF_ASSIGNMENT_TYPE_LABELS[a.type] ?? a.type}
                          </Badge>
                          {a.note && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {a.note}
                            </p>
                          )}
                          {a.author && (
                            <p className="text-xs text-muted-foreground">
                              Registrado por {a.author.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {a.type === "ASSIGN" ? "+" : "−"}
                          {formatCurrency(a.amount)}
                        </TableCell>
                        {canDelete && (
                          <TableCell className="text-right">
                            <DeleteAssignmentButton
                              id={a.id}
                              label={`${
                                STAFF_ASSIGNMENT_TYPE_LABELS[a.type] ?? a.type
                              } de ${formatCurrency(a.amount)} del ${formatDate(a.date)}`}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operaciones a su nombre */}
        <Card>
          <CardHeader>
            <CardTitle>Préstamos a su nombre</CardTitle>
            <CardDescription>
              {capital.totalOperations} operaciones ·{" "}
              {formatCurrency(capital.profit)} de utilidad realizada
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {operations.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Todavía no tiene operaciones registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operación</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((op) => {
                      const paid = op.installments.reduce(
                        (s, c) => s + c.paidAmount,
                        0,
                      );
                      const total = op.installments.reduce(
                        (s, c) => s + c.amount,
                        0,
                      );
                      return (
                        <TableRow key={op.id}>
                          <TableCell>
                            <Link
                              href={`/operaciones/${op.id}`}
                              className="font-medium hover:text-gold"
                            >
                              {op.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {op.code} · {formatDate(op.startDate)}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {formatCurrency(op.capitalUsed)}
                          </TableCell>
                          <TableCell className="text-right tabular text-muted-foreground">
                            {total > 0
                              ? `${formatCurrency(paid)} / ${formatCurrency(total)}`
                              : formatCurrency(op.returnAmount ?? 0)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={op.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
