"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAssignment } from "./actions";

/**
 * Borra un movimiento de caja mal registrado. Pide confirmación porque
 * cambia el efectivo en mano del trabajador; queda traza en la bitácora.
 */
export function DeleteAssignmentButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Eliminar movimiento"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
            <DialogDescription>
              Se va a borrar <strong>{label}</strong>. El efectivo en mano del
              trabajador se recalcula al instante y queda registro en la
              bitácora.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteAssignment(id);
                  setOpen(false);
                  toast.success("Movimiento eliminado");
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Borrando…" : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
