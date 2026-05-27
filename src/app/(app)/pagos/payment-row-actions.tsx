"use client";

import { useTransition } from "react";
import { Check, Undo2, Loader2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { markPaymentPaid, revertPaymentPaid } from "./actions";
import { toast } from "sonner";

export function PaymentRowActions({
  id,
  paid,
}: {
  id: string;
  paid: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {paid ? (
          <DropdownMenuItem
            onClick={() =>
              start(async () => {
                await revertPaymentPaid(id);
                toast.success("Pago revertido");
              })
            }
          >
            <Undo2 /> Revertir pago
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              start(async () => {
                await markPaymentPaid(id);
                toast.success("Pago registrado");
              })
            }
          >
            <Check /> Marcar como pagado
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
