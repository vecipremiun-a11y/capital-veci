"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createInvestorAccess,
  type AccessFormState,
} from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Creando…" : "Crear acceso"}
    </Button>
  );
}

export function InvestorAccessDialog({
  investorId,
  investorName,
  defaultEmail,
}: {
  investorId: string;
  investorName: string;
  defaultEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const actionWithId = createInvestorAccess.bind(null, investorId);
  const [state, action] = useActionState<AccessFormState, FormData>(
    actionWithId,
    {},
  );
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setShowPassword(false);
    }
  }, [state.ok]);

  return (
    <>
      <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
        <UserPlus /> Crear acceso al portal
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear acceso al portal</DialogTitle>
            <DialogDescription>
              Esta cuenta permitirá a{" "}
              <span className="font-medium text-foreground">{investorName}</span>{" "}
              acceder al portal del inversionista y ver solo sus propios datos.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="inversionista@correo.cl"
                defaultValue={defaultEmail ?? ""}
                autoComplete="off"
                required
              />
              {fe.email && (
                <p className="text-xs text-destructive">{fe.email}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Será el usuario de inicio de sesión.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña inicial</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  minLength={8}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar" : "Mostrar"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {fe.password && (
                <p className="text-xs text-destructive">{fe.password}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Comunícala al inversionista por un canal seguro. Podrá cambiarla
                después.
              </p>
            </div>

            {state.error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
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
