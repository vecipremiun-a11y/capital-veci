"use client";

import { useState, useTransition } from "react";
import { Printer, PenLine, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { signContract } from "../actions";
import { toast } from "sonner";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer /> Descargar / Imprimir PDF
    </Button>
  );
}

export function SignContractDialog({
  id,
  defaultName,
  signed,
}: {
  id: string;
  defaultName: string;
  signed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [accepted, setAccepted] = useState(false);
  const [pending, start] = useTransition();

  if (signed) {
    return (
      <Button variant="emerald" disabled>
        <CheckCircle2 /> Contrato firmado
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <PenLine /> Firmar digitalmente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Firma digital del contrato</DialogTitle>
          <DialogDescription>
            Al firmar se registra la aceptación digital y se genera el calendario
            de pagos del contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signature">Nombre de quien firma</Label>
            <Input
              id="signature"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--gold))]"
            />
            Declaro haber leído y aceptar las condiciones del presente contrato.
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="gold"
            disabled={!accepted || !name.trim() || pending}
            onClick={() =>
              start(async () => {
                await signContract(id, name);
                toast.success("Contrato firmado correctamente");
                setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            Confirmar firma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
