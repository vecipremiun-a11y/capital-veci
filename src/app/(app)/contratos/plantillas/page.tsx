import type { Metadata } from "next";
import { FileSignature, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Plantillas de contratos" };

const TEMPLATES = [
  {
    name: "Renta fija mensual",
    code: "RF-12",
    description:
      "Capital con rentabilidad mensual pactada, devolución al término del plazo.",
    rate: "10% – 14% anual",
    duration: "12 meses",
    modality: "FIXED",
    default: true,
  },
  {
    name: "Renta variable trimestral",
    code: "RV-T",
    description:
      "Rentabilidad asociada al resultado real de las operaciones, distribuida cada trimestre.",
    rate: "Variable",
    duration: "6 – 18 meses",
    modality: "VARIABLE",
  },
  {
    name: "Participación en operación",
    code: "PART",
    description:
      "El inversionista participa de la rentabilidad neta de una operación específica.",
    rate: "Según operación",
    duration: "Variable",
    modality: "PARTICIPATION",
  },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas de contratos"
        description="Modelos preconfigurados que aceleran la generación de contratos digitales."
      >
        <Button variant="outline">Crear plantilla</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card key={t.code} className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <FileSignature className="size-5" />
                </div>
                {t.default && <Badge variant="gold">Por defecto</Badge>}
              </div>
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Código</span>
                <span className="font-medium text-foreground">{t.code}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Rentabilidad</span>
                <span className="font-medium text-foreground">{t.rate}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Plazo</span>
                <span className="font-medium text-foreground">{t.duration}</span>
              </div>
              <Button variant="outline" className="mt-3 w-full">
                <Check /> Usar plantilla
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
