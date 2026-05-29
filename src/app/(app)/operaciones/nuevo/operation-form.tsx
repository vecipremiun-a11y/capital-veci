"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Users,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { createOperation, type OperationFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OPERATION_CATEGORY_OPTIONS,
  RISK_LABELS,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Investor = { id: string; fullName: string; investedCapital: number };
type Staff = { id: string; name: string; role: string };
type Participant = { investorId: string; amount: number };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Creando…" : "Crear operación"}
    </Button>
  );
}

export function OperationForm({
  investors,
  staff,
}: {
  investors: Investor[];
  staff: Staff[];
}) {
  const [state, action] = useActionState<OperationFormState, FormData>(
    createOperation,
    {},
  );
  const fe = state.fieldErrors ?? {};

  // Estado del formulario para el preview financiero en vivo
  const [capitalUsed, setCapitalUsed] = useState(0);
  const [expectedReturn, setExpectedReturn] = useState(20);
  const [duration, setDuration] = useState(3);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const investorsById = useMemo(
    () => new Map(investors.map((i) => [i.id, i])),
    [investors],
  );

  const participantsTotal = participants.reduce((s, p) => s + p.amount, 0);
  const companyShare = Math.max(capitalUsed - participantsTotal, 0);
  const exceedsCapital = participantsTotal > capitalUsed;
  const projectedReturn = capitalUsed * (1 + expectedReturn / 100);
  const projectedProfit = projectedReturn - capitalUsed;

  function addParticipant() {
    setParticipants((prev) => [...prev, { investorId: "", amount: 0 }]);
  }
  function removeParticipant(idx: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateParticipant(idx: number, patch: Partial<Participant>) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Datos generales */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de la operación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ej. Importación de mercadería verano"
                required
              />
              {fe.name && <p className="text-xs text-destructive">{fe.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <select
                id="category"
                name="category"
                className={selectClass}
                defaultValue="COMMERCIAL"
                required
              >
                {OPERATION_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business">Negocio asociado</Label>
              <Input
                id="business"
                name="business"
                placeholder="Ej. Sucursal Maipú"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Detalle de la operación…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsibleId">Responsable</Label>
              <select
                id="responsibleId"
                name="responsibleId"
                className={selectClass}
                defaultValue=""
              >
                <option value="">— Sin asignar —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskLevel">Nivel de riesgo</Label>
              <select
                id="riskLevel"
                name="riskLevel"
                className={selectClass}
                defaultValue="MEDIUM"
                required
              >
                {Object.entries(RISK_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Capital y plazos */}
        <Card>
          <CardHeader>
            <CardTitle>Capital y plazos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="capitalUsed">Capital utilizado (CLP)</Label>
              <Input
                id="capitalUsed"
                name="capitalUsed"
                type="number"
                min="0"
                step="1000"
                value={capitalUsed || ""}
                onChange={(e) => setCapitalUsed(Number(e.target.value))}
                required
              />
              {fe.capitalUsed && (
                <p className="text-xs text-destructive">{fe.capitalUsed}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedReturn">Retorno esperado (%)</Label>
              <Input
                id="expectedReturn"
                name="expectedReturn"
                type="number"
                min="0"
                max="500"
                step="0.5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationMonths">Duración (meses)</Label>
              <Input
                id="durationMonths"
                name="durationMonths"
                type="number"
                min="1"
                max="120"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={today}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="status">Estado inicial</Label>
              <select
                id="status"
                name="status"
                className={selectClass}
                defaultValue="ACTIVE"
              >
                <option value="ACTIVE">Activa (capital ya en uso)</option>
                <option value="PAUSED">Pausada</option>
                <option value="RISK">En riesgo</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Participantes inversionistas */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-gold" />
              <CardTitle>Inversionistas participantes</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addParticipant}
            >
              <Plus className="size-4" /> Agregar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {participants.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Esta operación se financia 100% con dinero de la empresa. Agrega
                inversionistas si participan con su capital.
              </p>
            )}
            {participants.map((p, idx) => (
              <div
                key={idx}
                className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Inversionista</Label>
                  <select
                    className={selectClass}
                    value={p.investorId}
                    onChange={(e) =>
                      updateParticipant(idx, { investorId: e.target.value })
                    }
                  >
                    <option value="">Selecciona…</option>
                    {investors.map((inv) => (
                      <option
                        key={inv.id}
                        value={inv.id}
                        disabled={
                          participants.some(
                            (other, i) =>
                              i !== idx && other.investorId === inv.id,
                          )
                        }
                      >
                        {inv.fullName} ({formatCurrency(inv.investedCapital)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aporte (CLP)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={p.amount || ""}
                    onChange={(e) =>
                      updateParticipant(idx, {
                        amount: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeParticipant(idx)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Quitar"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {/* Campo oculto: enviamos los participantes como JSON */}
            <input
              type="hidden"
              name="participants"
              value={JSON.stringify(
                participants.filter((p) => p.investorId && p.amount > 0),
              )}
            />
          </CardContent>
        </Card>

        {state.error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-2">
          <SubmitButton />
          <Button asChild variant="outline">
            <Link href="/operaciones">Cancelar</Link>
          </Button>
        </div>
      </div>

      {/* Preview financiero — espejo de lo que la BD va a registrar */}
      <div className="space-y-6">
        <Card className="border-gold/30 bg-gold/[0.03]">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="size-5 text-gold" />
              <CardTitle>Preview financiero</CardTitle>
            </div>
            <Badge variant="gold" className="w-fit text-[10px]">
              Así moverá el dinero
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Capital comprometido" value={formatCurrency(capitalUsed)} accent />
            <div className="gold-rule" />
            <Row
              label="Aporte de inversionistas"
              value={formatCurrency(participantsTotal)}
              hint={`${participants.length} participante(s)`}
            />
            <Row
              label="Aporte de la empresa"
              value={formatCurrency(companyShare)}
              hint={
                exceedsCapital
                  ? "⚠ Los aportes exceden el capital de la operación"
                  : "= capital − inversionistas"
              }
              danger={exceedsCapital}
            />
            <div className="gold-rule" />
            <Row
              label="Retorno proyectado"
              value={formatCurrency(projectedReturn)}
            />
            <Row
              label="Utilidad proyectada"
              value={formatCurrency(projectedProfit)}
              accent
              hint={`+${expectedReturn}% sobre el capital · ${duration} meses`}
            />
            <div className="rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
              <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
                <TrendingUp className="size-3.5 text-gold" /> Qué pasará al
                crearla
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Baja la liquidez disponible en {formatCurrency(capitalUsed)}</li>
                <li>Sube el capital comprometido en {formatCurrency(capitalUsed)}</li>
                <li>Se registra un movimiento tipo "Comprometido"</li>
                <li>Cada participante queda vinculado con su aporte</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  accent,
  hint,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={
            danger
              ? "font-semibold text-destructive tabular"
              : accent
                ? "font-semibold text-gold tabular"
                : "font-medium tabular"
          }
        >
          {value}
        </span>
      </div>
      {hint && (
        <p
          className={`mt-0.5 text-xs ${danger ? "text-destructive" : "text-muted-foreground"}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
