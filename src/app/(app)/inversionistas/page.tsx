import Link from "next/link";
import type { Metadata } from "next";
import { Plus, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatPercent, formatDate, formatRut, initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge, RiskBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvestorRowActions } from "./investor-row-actions";

export const metadata: Metadata = { title: "Inversionistas" };
export const dynamic = "force-dynamic";

export default async function InvestorsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const where = estado ? { status: estado } : {};

  const [investors, counts] = await Promise.all([
    db.investor.findMany({
      where,
      orderBy: { investedCapital: "desc" },
      include: { _count: { select: { contracts: true, payments: true } } },
    }),
    db.investor.groupBy({ by: ["status"], _count: true }),
  ]);

  const total = counts.reduce((s, c) => s + c._count, 0);
  const countOf = (s: string) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inversionistas"
        description="Gestión integral de inversionistas, capital, contratos y rentabilidad."
      >
        <Button asChild variant="gold">
          <Link href="/inversionistas/nuevo">
            <UserPlus /> Crear inversionista
          </Link>
        </Button>
      </PageHeader>

      <FilterTabs
        tabs={[
          { label: "Todos", value: null, count: total },
          { label: "Activos", value: "ACTIVE", count: countOf("ACTIVE") },
          { label: "Finalizados", value: "FINISHED", count: countOf("FINISHED") },
          { label: "En riesgo", value: "RISK", count: countOf("RISK") },
          { label: "Bloqueados", value: "BLOCKED", count: countOf("BLOCKED") },
        ]}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inversionista</TableHead>
              <TableHead>RUT</TableHead>
              <TableHead className="text-right">Capital invertido</TableHead>
              <TableHead className="text-right">Rentab.</TableHead>
              <TableHead>Ingreso</TableHead>
              <TableHead>Riesgo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {investors.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>
                  <Link
                    href={`/inversionistas/${inv.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(inv.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium group-hover:text-gold transition-colors">
                        {inv.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv._count.contracts} contratos · {inv._count.payments}{" "}
                        pagos
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular">
                  {formatRut(inv.rut)}
                </TableCell>
                <TableCell className="text-right font-medium tabular">
                  {formatCurrency(inv.investedCapital)}
                </TableCell>
                <TableCell className="text-right tabular text-[hsl(var(--success))]">
                  {formatPercent(inv.expectedReturn)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(inv.joinDate)}
                </TableCell>
                <TableCell>
                  <RiskBadge level={inv.riskLevel} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={inv.status} />
                </TableCell>
                <TableCell>
                  <InvestorRowActions
                    id={inv.id}
                    blocked={inv.status === "BLOCKED"}
                  />
                </TableCell>
              </TableRow>
            ))}
            {investors.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Plus className="size-8 opacity-40" />
                    <p>No hay inversionistas en este filtro.</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/inversionistas/nuevo">
                        Crear el primero
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
