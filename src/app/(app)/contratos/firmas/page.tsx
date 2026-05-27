import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Firmas digitales" };
export const dynamic = "force-dynamic";

export default async function SignaturesPage() {
  const signed = await db.contract.findMany({
    where: { status: "SIGNED" },
    include: { investor: true },
    orderBy: { signedAt: "desc" },
  });
  const pending = await db.contract.findMany({
    where: { status: "DRAFT" },
    include: { investor: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Firmas digitales"
        description="Registro de aceptaciones digitales y contratos pendientes de firma."
      />

      <Card>
        <div className="border-b border-border p-4 text-sm font-medium">
          Pendientes de firma ({pending.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Inversionista</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.code}</TableCell>
                <TableCell>{c.investor.fullName}</TableCell>
                <TableCell className="text-right tabular">
                  {formatCurrency(c.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell>
                  <Link href={`/contratos/${c.id}`} className="text-gold text-sm">
                    Firmar →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {pending.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No hay contratos pendientes de firma.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="border-b border-border p-4 text-sm font-medium">
          Firmados ({signed.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Inversionista</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Fecha de firma</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signed.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.code}</TableCell>
                <TableCell>{c.investor.fullName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.signatureName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(c.signedAt)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatCurrency(c.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
