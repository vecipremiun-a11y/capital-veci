"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { collectInstallment, revertInstallmentPaid } from "../actions";
import { toast } from "sonner";

export function InstallmentRowActions({
  id,
  sequence,
  amount,
  paidAmount,
}: {
  id: string;
  sequence: number;
  amount: number;
  paidAmount: number;
}) {
  const remaining = Math.max(amount - paidAmount, 0);
  const fullyPaid = remaining <= 0;
  const hasAbono = paidAmount > 0;

  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function doRevert() {
    start(async () => {
      await revertInstallmentPaid(id);
      toast.success("Cobro revertido");
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {!fullyPaid && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Check /> Cobrar
        </Button>
      )}
      {hasAbono && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={pending}
          onClick={doRevert}
          title="Revertir todos los abonos de esta cuota"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
        </Button>
      )}

      <CollectDialog
        open={open}
        onOpenChange={setOpen}
        id={id}
        sequence={sequence}
        amount={amount}
        paidAmount={paidAmount}
      />
    </div>
  );
}

function CollectDialog({
  open,
  onOpenChange,
  id,
  sequence,
  amount,
  paidAmount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  id: string;
  sequence: number;
  amount: number;
  paidAmount: number;
}) {
  const remaining = Math.max(amount - paidAmount, 0);
  const [value, setValue] = useState<number>(remaining);
  const [pending, start] = useTransition();

  // El modal se abre desde un botón externo (setOpen(true)), por lo que Radix
  // no dispara onOpenChange al abrir. Reseteamos el monto al saldo cada vez que
  // el modal pasa a abierto (o si el saldo cambió tras un abono previo).
  useEffect(() => {
    if (open) setValue(remaining);
  }, [open, remaining]);

  const excedente = Math.max(value - remaining, 0);

  function submit() {
    if (!value || value <= 0) {
      toast.error("Ingresa un monto mayor a 0");
      return;
    }
    start(async () => {
      const res = await collectInstallment(id, value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const spill =
        (res.installmentsTouched ?? 1) > 1
          ? ` · excedente aplicado a ${(res.installmentsTouched ?? 1) - 1} cuota(s) siguiente(s)`
          : "";
      const sobro =
        res.leftover && res.leftover > 0
          ? ` · sobró ${formatCurrency(res.leftover)} (excede el total)`
          : "";
      toast.success(
        `Cobrado ${formatCurrency(res.applied ?? value)}${spill}${sobro}`,
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro — Cuota #{sequence}</DialogTitle>
          <DialogDescription>
            El monto se aplica a esta cuota; si es mayor al saldo, el excedente
            se cobra automáticamente a las cuotas siguientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card/60 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Cuota</p>
              <p className="font-medium tabular">{formatCurrency(amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ya cobrado</p>
              <p className="font-medium tabular">
                {formatCurrency(paidAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="font-semibold text-gold tabular">
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collectAmount">Monto a cobrar (CLP)</Label>
            <MoneyInput
              id="collectAmount"
              autoFocus
              value={value}
              onValueChange={setValue}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setValue(remaining)}
                  className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/40"
                >
                  Saldo {formatCurrency(remaining)}
                </button>
              )}
              {excedente > 0 && (
                <span className="rounded border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs text-gold">
                  Excedente {formatCurrency(excedente)} → próximas cuotas
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gold"
            onClick={submit}
            disabled={pending}
          >
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Guardando…" : "Registrar cobro"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
