import type { Metadata } from "next";
import Link from "next/link";
import { Check, FileSignature, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/format";
import {
  CONTRACT_MODALITY_LABELS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/lib/constants";
import {
  CreateTemplateDialog,
  DeleteTemplateButton,
} from "./templates-ui";

export const metadata: Metadata = { title: "Plantillas de contratos" };
export const dynamic = "force-dynamic";

function rateText(t: {
  rateLabel: string | null;
  returnRate: number | null;
}) {
  if (t.rateLabel) return t.rateLabel;
  if (t.returnRate != null) return `${formatPercent(t.returnRate)} anual`;
  return "Variable";
}

function durationText(t: {
  durationLabel: string | null;
  durationMonths: number | null;
}) {
  if (t.durationLabel) return t.durationLabel;
  if (t.durationMonths != null) return `${t.durationMonths} meses`;
  return "Variable";
}

export default async function TemplatesPage() {
  const templates = await db.contractTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas de contratos"
        description="Modelos preconfigurados que aceleran la generación de contratos digitales."
      >
        <CreateTemplateDialog />
      </PageHeader>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Sparkles className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aún no hay plantillas. Crea la primera para acelerar la generación
              de contratos.
            </p>
            <CreateTemplateDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                    <FileSignature className="size-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {t.isDefault && <Badge variant="gold">Por defecto</Badge>}
                    {!t.isDefault && (
                      <DeleteTemplateButton id={t.id} code={t.code} />
                    )}
                  </div>
                </div>
                <CardTitle>{t.name}</CardTitle>
                {t.description && (
                  <CardDescription>{t.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Código</span>
                  <span className="font-medium text-foreground">{t.code}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Modalidad</span>
                  <span className="font-medium text-foreground">
                    {CONTRACT_MODALITY_LABELS[t.modality] ?? t.modality}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Frecuencia</span>
                  <span className="font-medium text-foreground">
                    {PAYMENT_FREQUENCY_LABELS[t.paymentFrequency] ??
                      t.paymentFrequency}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Rentabilidad</span>
                  <span className="font-medium text-foreground">
                    {rateText(t)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Plazo</span>
                  <span className="font-medium text-foreground">
                    {durationText(t)}
                  </span>
                </div>
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link href={`/contratos/nuevo?template=${t.id}`}>
                    <Check /> Usar plantilla
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
