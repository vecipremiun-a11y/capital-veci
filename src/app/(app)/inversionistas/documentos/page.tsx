import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const documents = await db.document.findMany({
    where: { investorId: { not: null } },
    include: { investor: true },
    orderBy: { uploadedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos"
        description="Repositorio de documentación adjunta a inversionistas y contratos."
      >
        <Button variant="outline">
          <Upload /> Subir documento
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="py-6">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <FileText className="size-10 opacity-40" />
              <p>Aún no hay documentos cargados.</p>
              <p className="max-w-sm text-center text-sm">
                Los documentos adjuntos (cédulas, comprobantes, anexos de
                contratos) aparecerán aquí. Puedes adjuntarlos desde el perfil de
                cada inversionista.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <FileText className="size-5 text-gold" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.investor?.fullName} · {formatDate(d.uploadedAt)}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={d.url}>Abrir</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
