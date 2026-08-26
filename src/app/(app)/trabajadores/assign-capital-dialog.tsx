"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { recordAssignment, type AssignmentFormState } from "./actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Fecha de hoy en yyyy-mm-dd (hora local, sin desfase UTC). */
function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function SubmitButton({ type }: { type: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending
        ? "Guardando…"
        : type === "ASSIGN"
          ? "Registrar entrega"
          : "Registrar devolución"}
    </Button>
  );
}

export function AssignCapitalDialog({
  staff,
  preselected,
  label = "Entregar capital",
}: {
  staff: { id: string; name: string; role: string }[];
  preselected?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"ASSIGN" | "RETURN">("ASSIGN");
  const [amount, setAmount] = useState(0);
  const [state, action] = useActionState<AssignmentFormState, FormData>(
    recordAssignment,
    {},
  );
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setAmount(0);
      toast.success(
        type === "ASSIGN" ? "Entrega registrada" : "Devolución registrada",
      );
    }
    // `type` queda fuera: solo reaccionamos al resultado del servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)}>
        <HandCoins /> {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Movimiento de caja</DialogTitle>
            <DialogDescription>
              Registra el efectivo que le entregas a un trabajador para que lo
              coloque en préstamos, o el que te devuelve.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de movimiento</Label>
              <select
                id="type"
                name="type"
                className={selectClass}
                value={type}
                onChange={(e) => setType(e.target.value as "ASSIGN" | "RETURN")}
              >
                <option value="ASSIGN">
                  Entrega de capital (le paso plata)
                </option>
                <option value="RETURN">
                  Devolución a la empresa (me devuelve plata)
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userId">Trabajador</Label>
              <select
                id="userId"
                name="userId"
                className={selectClass}
                defaultValue={preselected ?? ""}
                required
              >
                <option value="" disabled>
                  Selecciona un trabajador…
                </option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {fe.userId && (
                <p className="text-xs text-destructive">{fe.userId}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <MoneyInput
                  id="amount"
                  name="amount"
                  value={amount}
                  onValueChange={setAmount}
                  required
                />
                {fe.amount && (
                  <p className="text-xs text-destructive">{fe.amount}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={todayISO()}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Nota (opcional)</Label>
              <Textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Ej. efectivo entregado en la oficina"
              />
            </div>

            {state.error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <SubmitButton type={type} />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
