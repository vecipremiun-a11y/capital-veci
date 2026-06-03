"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { createInvestor, type InvestorFormState } from "../actions";
import { Field, RutInput, PhoneInput } from "../investor-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Guardando…" : "Crear inversionista"}
    </Button>
  );
}

export function InvestorForm() {
  const [state, action] = useActionState<InvestorFormState, FormData>(
    createInvestor,
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
              <Input id="fullName" name="fullName" placeholder="Ej: María Fernanda Soto" required />
            </Field>
          </div>
          <RutInput serverError={fe.rut} />
          <PhoneInput serverError={fe.phone} />
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

      <p className="text-sm text-muted-foreground">
        El capital y la rentabilidad de este inversionista se calculan
        automáticamente a partir de sus contratos. Crea un contrato para
        registrar la inversión.
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
          <Link href="/inversionistas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
