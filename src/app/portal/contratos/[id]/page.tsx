import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Printer } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatRut,
} from "@/lib/format";
import { CONTRACT_MODALITY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PrintButton } from "@/app/(app)/contratos/[id]/contract-actions";

export const metadata: Metadata = { title: "Contrato" };
export const dynamic = "force-dynamic";

export default async function PortalContract({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [contract, settings] = await Promise.all([
    db.contract.findUnique({
      where: { id },
      include: { investor: true },
    }),
    db.companySettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!contract) notFound();
  // Asegura que el contrato pertenece al inversionista de la sesión
  if (contract.investorId !== session.investorId) redirect("/portal");

  const monthly = Math.round(
    (contract.amount * (contract.returnRate / 100)) / 12,
  );
  const company = settings?.companyName ?? "Capital Veci";
  const legal = settings?.legalName ?? "Veci Administración de Capital SpA";

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/portal">
            <ArrowLeft /> Volver
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={contract.status} />
          <PrintButton />
        </div>
      </div>

      <Card className="print-document mx-auto max-w-3xl p-10 sm:p-14">
        <CardContent className="p-0">
          <header className="mb-10 flex items-start justify-between border-b border-border pb-6">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
                <span className="font-display font-bold text-gold">V</span>
              </div>
              <div>
                <p className="font-display text-lg font-semibold">{company}</p>
                <p className="text-xs text-muted-foreground">{legal}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Contrato N° {contract.code}</p>
              <p className="text-muted-foreground">{formatDate(contract.startDate)}</p>
            </div>
          </header>

          <h2 className="mb-6 text-center font-display text-xl font-semibold uppercase tracking-wide">
            Contrato de Inversión de Capital Privado
          </h2>

          <div className="space-y-5 text-sm leading-relaxed">
            <p>
              En Santiago de Chile, con fecha {formatDate(contract.startDate)},
              entre <strong>{legal}</strong> y{" "}
              <strong>{contract.investor.fullName}</strong>, RUT{" "}
              {formatRut(contract.investor.rut)}, se celebra el presente contrato
              sujeto a las siguientes cláusulas:
            </p>
            <Clause n="PRIMERO — Objeto">
              El Inversionista aporta la suma de{" "}
              <strong>{formatCurrency(contract.amount)}</strong>, destinada a
              operaciones comerciales privadas.
            </Clause>
            <Clause n="SEGUNDO — Rentabilidad">
              El capital generará una rentabilidad de{" "}
              <strong>{formatPercent(contract.returnRate)}</strong> anual,
              modalidad{" "}
              <strong>{CONTRACT_MODALITY_LABELS[contract.modality] ?? contract.modality}</strong>,
              equivalente a un pago mensual estimado de{" "}
              <strong>{formatCurrency(monthly)}</strong>.
            </Clause>
            <Clause n="TERCERO — Plazo">
              Vigencia de <strong>{contract.durationMonths} meses</strong>,
              desde {formatDate(contract.startDate)} hasta{" "}
              {formatDate(contract.endDate)}.
            </Clause>
            <Clause n="CUARTO — Condiciones particulares">
              {contract.conditions}
            </Clause>
            <Clause n="QUINTO — Confidencialidad">
              Las partes se obligan a mantener estricta reserva sobre los
              términos del presente contrato.
            </Clause>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-12 text-center text-sm">
            <div>
              <div className="mb-2 border-t border-foreground/40 pt-2">{legal}</div>
              <p className="text-muted-foreground">El Administrador</p>
            </div>
            <div>
              <div className="mb-2 border-t border-foreground/40 pt-2">
                {contract.signatureName ?? contract.investor.fullName}
              </div>
              <p className="text-muted-foreground">
                El Inversionista
                {contract.signedAt
                  ? ` · Firmado el ${formatDate(contract.signedAt)}`
                  : " · Pendiente de firma"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Clause({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold">{n}.</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}
