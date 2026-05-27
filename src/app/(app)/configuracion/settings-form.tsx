"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateSettings, type SettingsState } from "./actions";
import { toast } from "sonner";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
      {pending ? "Guardando…" : "Guardar cambios"}
    </Button>
  );
}

export function SettingsForm({
  initial,
}: {
  initial: {
    companyName: string;
    legalName: string | null;
    taxId: string | null;
    reservePercentage: number;
    minLiquidity: number;
    maxCommitment: number;
    alertsEnabled: boolean;
  };
}) {
  const [state, action] = useActionState<SettingsState, FormData>(
    updateSettings,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Configuración actualizada");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>Datos institucionales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre comercial</Label>
            <Input id="companyName" name="companyName" defaultValue={initial.companyName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Razón social</Label>
            <Input id="legalName" name="legalName" defaultValue={initial.legalName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">RUT empresa</Label>
            <Input id="taxId" name="taxId" defaultValue={initial.taxId ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Políticas de capital</CardTitle>
          <CardDescription>
            Límites y reservas para el control de liquidez y riesgo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reservePercentage">% de reservas</Label>
            <Input
              id="reservePercentage"
              name="reservePercentage"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={initial.reservePercentage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minLiquidity">Liquidez mínima exigida (CLP)</Label>
            <Input
              id="minLiquidity"
              name="minLiquidity"
              type="number"
              min="0"
              step="1000000"
              defaultValue={initial.minLiquidity}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxCommitment">% máximo de capital comprometido</Label>
            <Input
              id="maxCommitment"
              name="maxCommitment"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={initial.maxCommitment}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
            <div>
              <p className="text-sm font-medium">Alertas automáticas</p>
              <p className="text-xs text-muted-foreground">
                Notificaciones de liquidez baja y compromiso excesivo
              </p>
            </div>
            <Switch
              name="alertsEnabled"
              defaultChecked={initial.alertsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {state.ok && (
              <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                <CheckCircle2 className="size-3.5" /> Cambios guardados
              </span>
            )}
          </p>
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}
