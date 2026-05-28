"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_FREQUENCY_OPTIONS } from "@/lib/constants";
import {
  createTemplate,
  deleteTemplate,
  type TemplateFormState,
} from "./actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Creando…" : "Crear plantilla"}
    </Button>
  );
}

export function CreateTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<TemplateFormState, FormData>(
    createTemplate,
    {},
  );
  const fe = state.fieldErrors ?? {};

  // Cuando el server confirma OK, cerrar el modal
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus /> Crear plantilla
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva plantilla de contrato</DialogTitle>
            <DialogDescription>
              Define un modelo reutilizable para acelerar la generación de
              contratos.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="RF-24"
                  required
                  className="uppercase"
                />
                {fe.code && (
                  <p className="text-xs text-destructive">{fe.code}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Renta fija anual"
                  required
                />
                {fe.name && (
                  <p className="text-xs text-destructive">{fe.name}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Breve descripción del modelo de contrato…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modality">Modalidad</Label>
                <select
                  id="modality"
                  name="modality"
                  className={selectClass}
                  defaultValue="FIXED"
                >
                  <option value="FIXED">Renta fija</option>
                  <option value="VARIABLE">Renta variable</option>
                  <option value="PARTICIPATION">Participación</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Frecuencia de pago</Label>
                <select
                  id="paymentFrequency"
                  name="paymentFrequency"
                  className={selectClass}
                  defaultValue="MONTHLY"
                >
                  {PAYMENT_FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="returnRate">Rentabilidad anual (%)</Label>
                <Input
                  id="returnRate"
                  name="returnRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="Vacío = variable"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rateLabel">Etiqueta rentabilidad</Label>
                <Input
                  id="rateLabel"
                  name="rateLabel"
                  placeholder="Ej. Variable"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Duración (meses)</Label>
                <Input
                  id="durationMonths"
                  name="durationMonths"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Vacío = variable"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationLabel">Etiqueta plazo</Label>
                <Input
                  id="durationLabel"
                  name="durationLabel"
                  placeholder="Ej. 6 – 18 meses"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Las etiquetas son solo para mostrar en la tarjeta. Los campos
              numéricos vacíos se interpretan como "variable" y al usar la
              plantilla el operador definirá el valor exacto.
            </p>

            {state.error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteTemplateButton({
  id,
  code,
}: {
  id: string;
  code: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      title="Eliminar plantilla"
      disabled={isPending}
      onClick={() => {
        if (
          confirm(
            `¿Eliminar la plantilla ${code}? Esta acción no se puede deshacer.`,
          )
        ) {
          startTransition(async () => {
            await deleteTemplate(id);
          });
        }
      }}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </Button>
  );
}
