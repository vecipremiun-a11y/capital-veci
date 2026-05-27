import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatRut,
} from "@/lib/format";
import {
  CONTRACT_MODALITY_LABELS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PrintButton, SignContractDialog } from "./contract-actions";

export const metadata: Metadata = { title: "Contrato" };
export const dynamic = "force-dynamic";

export default async function ContractDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, settings] = await Promise.all([
    db.contract.findUnique({ where: { id }, include: { investor: true } }),
    db.companySettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!contract) notFound();

  const monthly = Math.round(
    (contract.amount * (contract.returnRate / 100)) / 12,
  );
  const company = settings?.companyName ?? "Capital Veci";
  const legal = settings?.legalName ?? "Veci Administración de Capital SpA";

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/contratos">
            <ArrowLeft /> Volver a contratos
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold">
                Contrato {contract.code}
              </h1>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {contract.investor.fullName} · {formatRut(contract.investor.rut)}
            </p>
          </div>
          <div className="flex gap-2">
            <PrintButton />
            <SignContractDialog
              id={contract.id}
              defaultName={contract.investor.fullName}
              signed={contract.status === "SIGNED"}
            />
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Monto" value={formatCurrency(contract.amount)} />
          <Summary label="Retorno estimado anual" value={formatPercent(contract.returnRate)} />
          <Summary
            label="Frecuencia de pago"
            value={
              PAYMENT_FREQUENCY_LABELS[contract.paymentFrequency] ??
              contract.paymentFrequency
            }
          />
          <Summary label="Plazo" value={`${contract.durationMonths} meses`} />
        </div>
      </div>

      {/* Documento imprimible */}
      <Card className="print-document mx-auto max-w-3xl p-10 sm:p-14">
        <CardContent className="p-0">
          <header className="mb-10 flex items-start justify-between border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
                  <span className="font-display font-bold text-gold">V</span>
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">{company}</p>
                  <p className="text-xs text-muted-foreground">{legal}</p>
                </div>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Contrato N° {contract.code}</p>
              <p className="text-muted-foreground">
                {formatDate(contract.startDate)}
              </p>
            </div>
          </header>

          <h2 className="mb-6 text-center font-display text-xl font-semibold uppercase tracking-wide">
            Contrato de Inversión de Capital Privado
          </h2>

          <div className="space-y-5 text-sm leading-relaxed">
            <p>
              En Santiago de Chile, con fecha {formatDate(contract.startDate)},
              entre <strong>{legal}</strong> (en adelante, "el Administrador") y{" "}
              <strong>{contract.investor.fullName}</strong>, RUT{" "}
              {formatRut(contract.investor.rut)} (en adelante, "el
              Inversionista"), se celebra el presente contrato de inversión de
              capital privado, sujeto a las siguientes cláusulas:
            </p>

            <Clause n="PRIMERO — Objeto">
              El Inversionista aporta al Administrador la suma de{" "}
              <strong>{formatCurrency(contract.amount)}</strong>, destinada a
              operaciones comerciales privadas administradas por este último.
            </Clause>

            <Clause n="SEGUNDO — Retorno y frecuencia de pago">
              El capital aportado generará un retorno estimado de{" "}
              <strong>{formatPercent(contract.returnRate)}</strong> anual, bajo
              la modalidad de{" "}
              <strong>
                {CONTRACT_MODALITY_LABELS[contract.modality] ?? contract.modality}
              </strong>
              . La frecuencia de pago acordada es{" "}
              <strong>
                {(PAYMENT_FREQUENCY_LABELS[contract.paymentFrequency] ??
                  contract.paymentFrequency).toLowerCase()}
              </strong>
              {contract.paymentFrequency === "AT_MATURITY"
                ? `: capital e intereses se entregan en un único pago al vencimiento por un total estimado de ${formatCurrency(contract.amount + Math.round((contract.amount * contract.returnRate) / 100 / 12 * contract.durationMonths))}.`
                : contract.paymentFrequency === "CUSTOM"
                  ? `: una fracción del interés se paga cada ${contract.customIntervalMonths ?? 1} mes(es) y el resto se entrega con el capital al vencimiento.`
                  : `: pago periódico estimado de ${formatCurrency(monthly * (contract.paymentFrequency === "QUARTERLY" ? 3 : 1))}, con devolución del capital al vencimiento.`}
            </Clause>

            <Clause n="TERCERO — Plazo">
              El presente contrato tendrá una vigencia de{" "}
              <strong>{contract.durationMonths} meses</strong>, desde el{" "}
              {formatDate(contract.startDate)} hasta el{" "}
              {formatDate(contract.endDate)}, fecha en la cual se restituirá el
              capital aportado.
            </Clause>

            <Clause n="CUARTO — Condiciones particulares">
              {contract.conditions}
            </Clause>

            <Clause n="QUINTO — Confidencialidad">
              Las partes se obligan a mantener estricta reserva sobre los
              términos del presente contrato y la información asociada a las
              operaciones.
            </Clause>
          </div>

          {/* Firmas */}
          <div className="mt-16 grid grid-cols-2 gap-12 text-center text-sm">
            <div>
              <div className="mb-2 border-t border-foreground/40 pt-2">
                {legal}
              </div>
              <p className="text-muted-foreground">El Administrador</p>
            </div>
            <div>
              <div className="mb-2 border-t border-foreground/40 pt-2">
                {contract.signatureName ?? contract.investor.fullName}
              </div>
              <p className="text-muted-foreground">
                El Inversionista
                {contract.signedAt
                  ? ` · Firmado digitalmente el ${formatDate(contract.signedAt)}`
                  : " · Pendiente de firma"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular">{value}</p>
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
