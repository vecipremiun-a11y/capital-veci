import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { InvestorForm } from "./investor-form";

export const metadata: Metadata = { title: "Nuevo inversionista" };

export default function NewInvestorPage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href="/inversionistas">
          <ArrowLeft /> Volver a inversionistas
        </Link>
      </Button>
      <PageHeader
        title="Crear inversionista"
        description="Registra un nuevo inversionista con sus condiciones de capital y rentabilidad."
      />
      <InvestorForm />
    </div>
  );
}
