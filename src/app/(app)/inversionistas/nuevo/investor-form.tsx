"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { createInvestor, type InvestorFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Guardando…" : "Crear inversionista"}
    </Button>
  );
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function InvestorForm() {
  const [state, action] = useActionState<InvestorFormState, FormData>(
    createInvestor,
    {},
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del inversionista</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nombre completo / Razón social" name="fullName" error={fe.fullName}>
                <Input id="fullName" name="fullName" placeholder="Ej: María Fernanda Soto" required />
              </Field>
            </div>
            <Field label="RUT" name="rut" error={fe.rut}>
              <Input id="rut" name="rut" placeholder="12345678-9" required />
            </Field>
            <Field label="Teléfono" name="phone" error={fe.phone}>
              <Input id="phone" name="phone" placeholder="+56 9 ..." />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Correo electrónico" name="email" error={fe.email}>
                <Input id="email" name="email" type="email" placeholder="correo@dominio.cl" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notas internas" name="notes" error={fe.notes}>
                <Textarea id="notes" name="notes" placeholder="Observaciones, origen del capital, condiciones especiales…" />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Condiciones financieras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Capital invertido (CLP)" name="investedCapital" error={fe.investedCapital}>
              <Input id="investedCapital" name="investedCapital" type="number" min="0" step="1000" defaultValue="0" required />
            </Field>
            <Field label="Rentabilidad anual (%)" name="expectedReturn" error={fe.expectedReturn}>
              <Input id="expectedReturn" name="expectedReturn" type="number" min="0" max="100" step="0.5" defaultValue="12" required />
            </Field>
            <Field label="Nivel de riesgo" name="riskLevel" error={fe.riskLevel}>
              <select id="riskLevel" name="riskLevel" className={selectClass} defaultValue="LOW">
                <option value="LOW">Bajo</option>
                <option value="MEDIUM">Medio</option>
                <option value="HIGH">Alto</option>
              </select>
            </Field>
            <Field label="Estado" name="status" error={fe.status}>
              <select id="status" name="status" className={selectClass} defaultValue="ACTIVE">
                <option value="ACTIVE">Activo</option>
                <option value="FINISHED">Finalizado</option>
                <option value="RISK">En riesgo</option>
                <option value="BLOCKED">Bloqueado</option>
              </select>
            </Field>
          </CardContent>
        </Card>

        {state.error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-2">
          <SubmitButton />
          <Button asChild variant="outline">
            <Link href="/inversionistas">Cancelar</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
