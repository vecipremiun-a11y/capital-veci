import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EditInvestorForm } from "./edit-investor-form";

export const metadata: Metadata = { title: "Editar inversionista" };
export const dynamic = "force-dynamic";

export default async function EditInvestorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investor = await db.investor.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      rut: true,
      email: true,
      phone: true,
      notes: true,
      riskLevel: true,
      status: true,
    },
  });

  if (!investor) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href={`/inversionistas/${investor.id}`}>
          <ArrowLeft /> Volver al inversionista
        </Link>
      </Button>
      <PageHeader
        title="Editar inversionista"
        description="Actualiza los datos de contacto y la clasificación del inversionista."
      />
      <EditInvestorForm investor={investor} />
    </div>
  );
}
