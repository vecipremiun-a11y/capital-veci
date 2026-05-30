"use client";

import { useTransition } from "react";
import { Check, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markInstallmentPaid, revertInstallmentPaid } from "../actions";
import { toast } from "sonner";

export function InstallmentRowActions({
  id,
  paid,
}: {
  id: string;
  paid: boolean;
}) {
  const [pending, start] = useTransition();

  if (paid) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await revertInstallmentPaid(id);
            toast.success("Cobro revertido");
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Undo2 />} Revertir
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markInstallmentPaid(id);
          toast.success("Cuota cobrada");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />} Cobrar
    </Button>
  );
}
