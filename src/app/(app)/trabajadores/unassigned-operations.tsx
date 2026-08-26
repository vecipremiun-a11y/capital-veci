"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setOperationResponsible } from "./actions";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Selector para adoptar un préstamo huérfano: al elegir un trabajador, la
 * operación pasa a su caja y su capital deja de estar fuera del conteo.
 */
export function AssignResponsibleSelect({
  operationId,
  staff,
}: {
  operationId: string;
  staff: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Asignar responsable"
      className={selectClass}
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const userId = e.target.value;
        if (!userId) return;
        const name =
          staff.find((s) => s.id === userId)?.name ?? "el trabajador";
        const form = new FormData();
        form.set("operationId", operationId);
        form.set("userId", userId);
        startTransition(async () => {
          await setOperationResponsible(form);
          toast.success(`Préstamo asignado a ${name}`);
        });
      }}
    >
      <option value="" disabled>
        {pending ? "Asignando…" : "Asignar a…"}
      </option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
