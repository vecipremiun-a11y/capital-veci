"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { updateInvestor, type InvestorFormState } from "../../actions";
import { Field, RutInput, PhoneInput, selectClass } from "../../investor-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface EditInvestorData {
  id: string;
  fullName: string;
  rut: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  riskLevel: string;
  status: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Guardando…" : "Guardar cambios"}
    </Button>
  );
}

export function EditInvestorForm({ investor }: { investor: EditInvestorData }) {
  const updateWithId = updateInvestor.bind(null, investor.id);
  const [state, action] = useActionState<InvestorFormState, FormData>(
    updateWithId,
    {},
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del inversionista</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre completo / Razón social" name="fullName" error={fe.fullName}>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Ej: María Fernanda Soto"
                defaultValue={investor.fullName}
                required
              />
            </Field>
          </div>
          <RutInput serverError={fe.rut} defaultValue={investor.rut} />
          <PhoneInput serverError={fe.phone} defaultValue={investor.phone ?? ""} />
          <div className="sm:col-span-2">
            <Field label="Correo electrónico" name="email" error={fe.email}>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="correo@dominio.cl"
                defaultValue={investor.email ?? ""}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notas internas" name="notes" error={fe.notes}>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Observaciones, origen del capital, condiciones especiales…"
                defaultValue={investor.notes ?? ""}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clasificación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nivel de riesgo" name="riskLevel" error={fe.riskLevel}>
            <select id="riskLevel" name="riskLevel" className={selectClass} defaultValue={investor.riskLevel}>
              <option value="LOW">Bajo</option>
              <option value="MEDIUM">Medio</option>
              <option value="HIGH">Alto</option>
            </select>
          </Field>
          <Field label="Estado" name="status" error={fe.status}>
            <select id="status" name="status" className={selectClass} defaultValue={investor.status}>
              <option value="ACTIVE">Activo</option>
              <option value="FINISHED">Finalizado</option>
              <option value="RISK">En riesgo</option>
              <option value="BLOCKED">Bloqueado</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        El capital y la rentabilidad se calculan automáticamente desde los
        contratos del inversionista y no se editan aquí.
      </p>

      {state.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex gap-2">
        <SubmitButton />
        <Button asChild variant="outline">
          <Link href={`/inversionistas/${investor.id}`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
