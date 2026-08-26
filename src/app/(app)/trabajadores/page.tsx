import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, Briefcase, Wallet, Clock, Target } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getStaffCapital,
  getCapitalAllocation,
} from "@/lib/data/staff-capital";
import { ROLE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AssignCapitalDialog } from "./assign-capital-dialog";
import { AssignResponsibleSelect } from "./unassigned-operations";
import { CapitalAllocationCard } from "./capital-allocation-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Trabajadores" };
export const dynamic = "force-dynamic";

export default async function StaffCapitalPage() {
  await requirePermission("staff_capital");
  const [staff, allocation, orphans] = await Promise.all([
    getStaffCapital(),
    getCapitalAllocation(),
    // Préstamos sin responsable: su capital no aparece en la caja de nadie.
    db.operation.findMany({
      where: { responsibleId: null },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        capitalUsed: true,
        startDate: true,
      },
    }),
  ]);
  const orphanCapital = orphans.reduce((sum, o) => sum + o.capitalUsed, 0);

  const totals = staff.reduce(
    (acc, s) => ({
      assigned: acc.assigned + s.assigned,
      working: acc.working + s.working,
      expected: acc.expected + s.expected,
      toCollect: acc.toCollect + s.toCollect,
      available: acc.available + s.available,
    }),
    { assigned: 0, working: 0, expected: 0, toCollect: 0, available: 0 },
  );

  const options = staff.map((s) => ({
    id: s.userId,
    name: s.name,
    role: s.role,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trabajadores"
        description="Capital entregado a cada trabajador, cuánto tiene colocado en préstamos y cuánto efectivo le queda para seguir prestando."
      >
        <AssignCapitalDialog staff={options} />
      </PageHeader>

      <CapitalAllocationCard data={allocation} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Capital entregado"
          value={formatCurrency(totals.assigned)}
          icon={HandCoins}
          accent="gold"
          hint={`${staff.length} trabajadores`}
        />
        <KpiCard
          label="Colocado en préstamos"
          value={formatCurrency(totals.working)}
          icon={Briefcase}
          hint="Operaciones vigentes"
        />
        <KpiCard
          label="Monto esperado"
          value={formatCurrency(totals.expected)}
          icon={Target}
          hint={`+${formatCurrency(totals.expected - totals.working)} de ganancia`}
        />
        <KpiCard
          label="Por cobrar"
          value={formatCurrency(totals.toCollect)}
          icon={Clock}
          hint="Capital + interés pendiente"
        />
        <KpiCard
          label="Efectivo en mano"
          value={formatCurrency(totals.available)}
          icon={Wallet}
          accent={totals.available < 0 ? "danger" : "emerald"}
          hint="Disponible para prestar"
        />
      </div>

      {orphans.length > 0 && (
        <Card className="border-[hsl(var(--warning))]/40">
          <CardHeader>
            <CardTitle>Préstamos sin responsable</CardTitle>
            <CardDescription>
              {orphans.length} operaciones por {formatCurrency(orphanCapital)}{" "}
              que no están en la caja de nadie. Asígnalas para que su capital
              cuente en el trabajador correcto.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="w-52">Responsable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphans.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/operaciones/${o.id}`}
                          className="font-medium hover:text-gold"
                        >
                          {o.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {o.code} · {formatDate(o.startDate)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(o.capitalUsed)}
                      </TableCell>
                      <TableCell>
                        <AssignResponsibleSelect
                          operationId={o.id}
                          staff={options}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Caja por trabajador</CardTitle>
          <CardDescription>
            Esperado = capital colocado + interés pactado · Efectivo en mano =
            entregado − devuelto − colocado + cobrado
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {staff.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No hay trabajadores registrados. Crea usuarios desde el panel de
              administración.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trabajador</TableHead>
                    <TableHead className="text-right">Entregado</TableHead>
                    <TableHead className="text-right">Colocado</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Por cobrar</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead className="text-right">
                      Efectivo en mano
                    </TableHead>
                    <TableHead className="text-right">Préstamos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell>
                        <Link
                          href={`/trabajadores/${s.userId}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="size-9">
                            <AvatarFallback>{initials(s.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {ROLE_LABELS[s.role] ?? s.role}
                              {!s.active && " · inactivo"}
                            </p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(s.assigned)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(s.working)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tabular">
                          {formatCurrency(s.expected)}
                        </span>
                        {s.expected > s.working && (
                          <p className="text-xs text-[hsl(var(--success))] tabular">
                            +{formatCurrency(s.expected - s.working)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {formatCurrency(s.toCollect)}
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {formatCurrency(s.collected)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            s.available < 0
                              ? "font-semibold tabular text-[hsl(var(--danger))]"
                              : "font-semibold tabular text-gold"
                          }
                        >
                          {formatCurrency(s.available)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={s.liveOperations > 0 ? "gold" : "outline"}
                        >
                          {s.liveOperations} activos
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
