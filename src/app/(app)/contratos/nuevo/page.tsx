import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ContractForm } from "./contract-form";

export const metadata: Metadata = { title: "Generar contrato" };
export const dynamic = "force-dynamic";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ investor?: string }>;
}) {
  const { investor } = await searchParams;
  const investors = await db.investor.findMany({
    where: { status: { in: ["ACTIVE", "RISK"] } },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      expectedReturn: true,
      investedCapital: true,
    },
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href="/contratos">
          <ArrowLeft /> Volver a contratos
        </Link>
      </Button>
      <PageHeader
        title="Generar contrato"
        description="Crea un contrato de inversión con simulación de rentabilidad en tiempo real."
      />
      <ContractForm investors={investors} preselected={investor} />
    </div>
  );
}
