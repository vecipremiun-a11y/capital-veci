import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { inferFrequency } from "@/lib/loans";
import { DEFAULT_COLLECT_WEEKDAYS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  OperationForm,
  type OperationInitialValues,
} from "../../nuevo/operation-form";

export const metadata: Metadata = { title: "Editar operación" };
export const dynamic = "force-dynamic";

function toDateInput(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function parseWeekdays(csv: string | null): number[] {
  if (!csv) return [...DEFAULT_COLLECT_WEEKDAYS];
  const days = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length > 0 ? days : [...DEFAULT_COLLECT_WEEKDAYS];
}

export default async function EditOperationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [op, investors, staff] = await Promise.all([
    db.operation.findUnique({
      where: { id },
      include: {
        installments: { orderBy: { sequence: "asc" } },
        loanPayments: { select: { id: true } },
        participants: { select: { investorId: true, amount: true } },
      },
    }),
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

  if (!op) notFound();

  const isLoan = op.category === "LOANS";
  const backLink = `/operaciones/${op.id}`;

  // No se editan operaciones cerradas.
  if (op.status === "FINISHED" || op.status === "LOSS") {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href={backLink}>
            <ArrowLeft /> Volver a la operación
          </Link>
        </Button>
        <PageHeader title="No editable" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Esta operación está cerrada ({op.status === "FINISHED" ? "finalizada" : "pérdida"})
            y no se puede editar.
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasCollections =
    op.installments.some((i) => i.paidAmount > 0) || op.loanPayments.length > 0;

  const durationMonths = op.endDate
    ? Math.max(
        1,
        (op.endDate.getFullYear() - op.startDate.getFullYear()) * 12 +
          (op.endDate.getMonth() - op.startDate.getMonth()),
      )
    : 3;

  const initialValues: OperationInitialValues = {
    name: op.name,
    category: op.category,
    business: op.business,
    description: op.description,
    responsibleId: op.responsibleId,
    riskLevel: op.riskLevel,
    capitalUsed: op.capitalUsed,
    expectedReturn: op.expectedReturn,
    startDate: toDateInput(op.startDate),
    durationMonths,
    isDailyLoan: op.isDailyLoan,
    frequency: inferFrequency(op.installments.map((i) => i.dueDate)),
    termDays: op.installments.length || op.dailyTermDays || 24,
    dailyAmount: op.installments[0]?.amount ?? 25000,
    collectWeekdays: parseWeekdays(op.collectWeekdays),
    borrowerName: op.borrowerName,
    borrowerPhone: op.borrowerPhone,
    participants: op.participants.map((p) => ({
      investorId: p.investorId,
      amount: p.amount,
    })),
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link href={backLink}>
          <ArrowLeft /> Volver a la operación
        </Link>
      </Button>
      <PageHeader
        title={isLoan ? "Editar préstamo" : "Editar operación"}
        description={
          hasCollections
            ? "Este préstamo tiene cobros: solo puedes editar cliente, teléfono, riesgo y nota."
            : "Corrige los datos. Si cambias montos o fechas, el calendario de cuotas se regenera."
        }
      />
      <OperationForm
        investors={investors}
        staff={staff}
        mode="edit"
        operationId={op.id}
        initialValues={initialValues}
        locked={hasCollections}
      />
    </div>
  );
}
