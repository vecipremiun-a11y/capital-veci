import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OperationForm } from "./operation-form";

export const metadata: Metadata = { title: "Nueva operación" };
export const dynamic = "force-dynamic";

export default async function NewOperationPage() {
  const [investors, staff] = await Promise.all([
    db.investor.findMany({
      where: { status: { in: ["ACTIVE", "RISK"] } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, investedCapital: true },
    }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "OPERADOR", "CONTADOR"] }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href="/operaciones">
          <ArrowLeft /> Volver a operaciones
        </Link>
      </Button>
      <PageHeader
        title="Nueva operación"
        description="Define dónde se va a invertir el capital. Al crearla, baja la liquidez disponible y sube el capital comprometido automáticamente."
      />
      <OperationForm investors={investors} staff={staff} />
    </div>
  );
}
