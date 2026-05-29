"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  finalizeOperation,
  markOperationLoss,
  setOperationStatus,
  type OperationFormState,
} from "../actions";

export function OperationActions({
  operationId,
  status,
  capitalUsed,
}: {
  operationId: string;
  status: string;
  capitalUsed: number;
}) {
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function quickChange(target: string, label: string) {
    if (!confirm(`¿Cambiar la operación a "${label}"?`)) return;
    startTransition(async () => {
      try {
        await setOperationStatus(operationId, target);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error";
        alert(msg);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Cambios rápidos de estado (siguen comprometiendo capital) */}
      {status === "ACTIVE" && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => quickChange("PAUSED", "Pausada")}
          >
            <Pause className="size-3.5" /> Pausar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => quickChange("RISK", "En riesgo")}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <AlertTriangle className="size-3.5" /> Marcar riesgo
          </Button>
        </>
      )}
      {status === "PAUSED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => quickChange("ACTIVE", "Activa")}
        >
          <Play className="size-3.5" /> Reanudar
        </Button>
      )}
      {status === "RISK" && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => quickChange("ACTIVE", "Activa")}
        >
          <Play className="size-3.5" /> Volver a activa
        </Button>
      )}

      {/* Cierre con ganancia */}
      <Button
        variant="gold"
        size="sm"
        onClick={() => setFinalizeOpen(true)}
        disabled={isPending}
      >
        <CheckCircle2 className="size-3.5" /> Finalizar
      </Button>

      {/* Cierre con pérdida */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLossOpen(true)}
        disabled={isPending}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <TrendingDown className="size-3.5" /> Marcar pérdida
      </Button>

      <FinalizeDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        operationId={operationId}
        capitalUsed={capitalUsed}
      />
      <LossDialog
        open={lossOpen}
        onOpenChange={setLossOpen}
        operationId={operationId}
        capitalUsed={capitalUsed}
      />
    </div>
  );
}

// ---------- Diálogo: Finalizar con retorno ----------

function FinalizeSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Cerrando…" : "Confirmar cierre"}
    </Button>
  );
}

function FinalizeDialog({
  open,
  onOpenChange,
  operationId,
  capitalUsed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  operationId: string;
  capitalUsed: number;
}) {
  const actionWithId = finalizeOperation.bind(null, operationId);
  const [state, action] = useActionState<OperationFormState, FormData>(
    actionWithId,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const [returnAmount, setReturnAmount] = useState<number>(capitalUsed);
  const profit = returnAmount - capitalUsed;
  const pct = capitalUsed > 0 ? (profit / capitalUsed) * 100 : 0;

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar operación</DialogTitle>
          <DialogDescription>
            Registra cuánto dinero volvió. El sistema calcula la utilidad y la
            reparte pro rata a los inversionistas participantes.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="returnAmount">Monto devuelto (CLP)</Label>
            <Input
              id="returnAmount"
              name="returnAmount"
              type="number"
              min="0"
              step="1000"
              value={returnAmount || ""}
              onChange={(e) => setReturnAmount(Number(e.target.value))}
              required
            />
            {fe.returnAmount && (
              <p className="text-xs text-destructive">{fe.returnAmount}</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Capital invertido</span>
              <span className="tabular">{formatCurrency(capitalUsed)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monto devuelto</span>
              <span className="tabular">{formatCurrency(returnAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-medium">Utilidad</span>
              <span
                className={`font-semibold tabular ${
                  profit >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"
                }`}
              >
                {profit >= 0 ? "+" : ""}
                {formatCurrency(profit)} ({pct.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="result">Nota de cierre (opcional)</Label>
            <Textarea
              id="result"
              name="result"
              rows={2}
              placeholder="Comentario sobre el resultado…"
            />
          </div>

          {state.error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <FinalizeSubmit />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Diálogo: Marcar pérdida ----------

function LossSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Registrando…" : "Confirmar pérdida"}
    </Button>
  );
}

function LossDialog({
  open,
  onOpenChange,
  operationId,
  capitalUsed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  operationId: string;
  capitalUsed: number;
}) {
  const actionWithId = markOperationLoss.bind(null, operationId);
  const [state, action] = useActionState<OperationFormState, FormData>(
    actionWithId,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const [recovered, setRecovered] = useState<number>(0);
  const lost = Math.max(capitalUsed - Math.min(recovered, capitalUsed), 0);

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar operación con pérdida</DialogTitle>
          <DialogDescription>
            Acción irreversible. La operación se cerrará como LOSS y se generará
            una alerta de peligro.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovered">Monto recuperado (CLP)</Label>
            <Input
              id="recovered"
              name="recovered"
              type="number"
              min="0"
              max={capitalUsed}
              step="1000"
              value={recovered || ""}
              onChange={(e) => setRecovered(Number(e.target.value))}
              required
            />
            {fe.recovered && (
              <p className="text-xs text-destructive">{fe.recovered}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Pon 0 si no se recuperó nada.
            </p>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Capital invertido</span>
              <span className="tabular">{formatCurrency(capitalUsed)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recuperado</span>
              <span className="tabular">{formatCurrency(recovered)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-destructive/30 pt-2">
              <span className="font-medium text-destructive">Pérdida</span>
              <span className="font-semibold text-destructive tabular">
                −{formatCurrency(lost)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="result">Motivo (opcional)</Label>
            <Textarea
              id="result"
              name="result"
              rows={2}
              placeholder="Qué pasó…"
            />
          </div>

          {state.error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <LossSubmit />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
