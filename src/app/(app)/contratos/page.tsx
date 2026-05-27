import Link from "next/link";
import type { Metadata } from "next";
import { FileSignature, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { CONTRACT_MODALITY_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
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

export const metadata: Metadata = { title: "Contratos" };
export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const where = estado ? { status: estado } : {};

  const [contracts, counts] = await Promise.all([
    db.contract.findMany({
      where,
      include: { investor: true },
      orderBy: { createdAt: "desc" },
    }),
    db.contract.groupBy({ by: ["status"], _count: true }),
  ]);

  const total = counts.reduce((s, c) => s + c._count, 0);
  const countOf = (s: string) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos digitales"
        description="Generación, firma y seguimiento de contratos de inversión."
      >
        <Button asChild variant="gold">
          <Link href="/contratos/nuevo">
            <FileSignature /> Generar contrato
          </Link>
        </Button>
      </PageHeader>

      <FilterTabs
        tabs={[
          { label: "Todos", value: null, count: total },
          { label: "Borradores", value: "DRAFT", count: countOf("DRAFT") },
          { label: "Firmados", value: "SIGNED", count: countOf("SIGNED") },
          { label: "Activos", value: "ACTIVE", count: countOf("ACTIVE") },
          { label: "Vencidos", value: "EXPIRED", count: countOf("EXPIRED") },
        ]}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Inversionista</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead className="text-right">Rentab.</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.code}</TableCell>
                <TableCell>
                  <Link
                    href={`/inversionistas/${c.investorId}`}
                    className="hover:text-gold"
                  >
                    {c.investor.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatCurrency(c.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {CONTRACT_MODALITY_LABELS[c.modality] ?? c.modality}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatPercent(c.returnRate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(c.endDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/contratos/${c.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Plus className="size-8 opacity-40" />
                    <p>No hay contratos en este filtro.</p>
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
