import type { Metadata } from "next";
import { Database, Lock, Bell } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "./settings-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await db.companySettings.findUnique({
    where: { id: "singleton" },
  });

  const initial = {
    companyName: settings?.companyName ?? "Capital Veci",
    legalName: settings?.legalName ?? null,
    taxId: settings?.taxId ?? null,
    reservePercentage: settings?.reservePercentage ?? 20,
    minLiquidity: settings?.minLiquidity ?? 0,
    maxCommitment: settings?.maxCommitment ?? 80,
    alertsEnabled: settings?.alertsEnabled ?? true,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Parámetros generales de la empresa, políticas de capital, alertas y seguridad."
      />

      <SettingsForm initial={initial} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Database className="size-5" />
            </div>
            <CardTitle>Base de datos</CardTitle>
            <CardDescription>
              Conectada vía adaptador libSQL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Motor" value="SQLite / libSQL (Turso)" />
            <Row
              label="Modo"
              value={
                process.env.TURSO_DATABASE_URL
                  ? "Turso nube"
                  : "Local · dev.db"
              }
            />
            <p className="pt-2 text-xs text-muted-foreground">
              Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env para
              conectar a tu base Turso.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Lock className="size-5" />
            </div>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>Acceso, sesiones y auditoría.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sesiones" value="JWT firmadas · 8 h" />
            <Row label="Contraseñas" value="bcrypt (10 rondas)" />
            <Row label="Bitácora" value="Activa" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Bell className="size-5" />
            </div>
            <CardTitle>Alertas y notificaciones</CardTitle>
            <CardDescription>
              Liquidez, vencimientos y pagos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Liquidez baja" value="Habilitada" />
            <Row label="Compromiso excesivo" value="Habilitada" />
            <Row label="Pagos vencidos" value="Habilitada" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
