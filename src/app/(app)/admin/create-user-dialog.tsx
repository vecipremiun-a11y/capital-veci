"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
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
import { createUser, type UserFormState } from "./actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Creando…" : "Crear usuario"}
    </Button>
  );
}

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action] = useActionState<UserFormState, FormData>(
    createUser,
    {},
  );
  const fe = state.fieldErrors ?? {};

  // Al recibir OK del servidor, cerramos el modal
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setShowPassword(false);
    }
  }, [state.ok]);

  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)}>
        <KeyRound /> Crear usuario
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
            <DialogDescription>
              Agrega un trabajador al sistema con un rol y contraseña inicial.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ej. María González"
                autoComplete="name"
                required
              />
              {fe.name && (
                <p className="text-xs text-destructive">{fe.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="usuario@capitalveci.cl"
                autoComplete="off"
                required
              />
              {fe.email && (
                <p className="text-xs text-destructive">{fe.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                name="role"
                className={selectClass}
                defaultValue="OPERADOR"
                required
              >
                <option value="ADMIN">Administrador</option>
                <option value="CONTADOR">Contador</option>
                <option value="OPERADOR">Operador</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Para crear inversionistas usa{" "}
                <span className="text-foreground">Inversionistas → Nuevo</span>.
              </p>
              {fe.role && (
                <p className="text-xs text-destructive">{fe.role}</p>
              )}
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
              <p className="text-xs text-muted-foreground">
                El usuario podrá cambiarla más adelante.
              </p>
              {fe.password && (
                <p className="text-xs text-destructive">{fe.password}</p>
              )}
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
