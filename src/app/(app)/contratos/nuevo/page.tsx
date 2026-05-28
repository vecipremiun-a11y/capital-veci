import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContractForm } from "./contract-form";

export const metadata: Metadata = { title: "Generar contrato" };
export const dynamic = "force-dynamic";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ investor?: string; template?: string }>;
}) {
  const { investor, template: templateId } = await searchParams;

  const [investors, template] = await Promise.all([
    db.investor.findMany({
      where: { status: { in: ["ACTIVE", "RISK"] } },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        expectedReturn: true,
        investedCapital: true,
      },
    }),
    templateId
      ? db.contractTemplate.findUnique({ where: { id: templateId } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href={template ? "/contratos/plantillas" : "/contratos"}>
          <ArrowLeft />
          {template ? "Volver a plantillas" : "Volver a contratos"}
        </Link>
      </Button>
      <PageHeader
        title="Generar contrato"
        description={
          template
            ? `Plantilla "${template.name}" aplicada. Ajusta los datos y firma.`
            : "Crea un contrato de inversión con simulación de rentabilidad en tiempo real."
        }
      >
        {template && (
          <Badge variant="gold" className="text-[11px]">
            Plantilla · {template.code}
          </Badge>
        )}
      </PageHeader>
      <ContractForm
        investors={investors}
        preselected={investor}
        template={
          template
            ? {
                modality: template.modality,
                paymentFrequency: template.paymentFrequency,
                returnRate: template.returnRate,
                durationMonths: template.durationMonths,
                customIntervalMonths: template.customIntervalMonths,
                periodicInterestPct: template.periodicInterestPct,
              }
            : undefined
        }
      />
    </div>
  );
}
