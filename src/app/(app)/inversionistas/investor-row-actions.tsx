"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Ban, CheckCircle2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toggleInvestorBlock } from "./actions";
import { toast } from "sonner";

export function InvestorRowActions({
  id,
  blocked,
}: {
  id: string;
  blocked: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <MoreHorizontal />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/inversionistas/${id}`}>
            <Eye /> Ver perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={blocked ? "" : "text-destructive"}
          onClick={() =>
            start(async () => {
              await toggleInvestorBlock(id);
              toast.success(
                blocked ? "Inversionista reactivado" : "Inversionista bloqueado",
              );
            })
          }
        >
          {blocked ? (
            <>
              <CheckCircle2 /> Reactivar
            </>
          ) : (
            <>
              <Ban /> Bloquear
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
