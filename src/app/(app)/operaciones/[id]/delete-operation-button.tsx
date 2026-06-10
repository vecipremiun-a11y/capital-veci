"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteOperation } from "../actions";

/**
 * Elimina una operación/préstamo creado por error. Solo se renderiza cuando la
 * operación no tiene cobros y no está cerrada (la página lo valida); el server
 * action vuelve a validarlo como segundo resguardo.
 */
export function DeleteOperationButton({
  operationId,
  label,
}: {
  operationId: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  function onClick() {
    if (
      !confirm(
        `¿Eliminar "${label}"? Esta acción no se puede deshacer y libera el capital comprometido.`,
      )
    )
      return;
    start(async () => {
      try {
        await deleteOperation(operationId);
        // En éxito, el server action redirige a /operaciones (no llega aquí).
      } catch (e: unknown) {
        // redirect() lanza un error especial de Next que NO es un fallo real.
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
        const msg = e instanceof Error ? e.message : "No se pudo eliminar.";
        toast.error(msg);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={onClick}
      className="border-destructive/40 text-destructive hover:bg-destructive/10"
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 className="size-3.5" />}
      Eliminar
    </Button>
  );
}
