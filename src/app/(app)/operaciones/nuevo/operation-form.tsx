"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  Coins,
  Loader2,
  Plus,
  Trash2,
  Users,
  Wallet,
  TrendingUp,
} from "lucide-react";
import {
  createOperation,
  updateOperation,
  type OperationFormState,
} from "../actions";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  OPERATION_CATEGORY_OPTIONS,
  RISK_LABELS,
  WEEKDAY_SHORT,
  DEFAULT_COLLECT_WEEKDAYS,
} from "@/lib/constants";
import { buildLoanSchedule, type LoanFrequency } from "@/lib/loans";
import { formatCurrency, formatDate } from "@/lib/format";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Investor = { id: string; fullName: string; investedCapital: number };
type Staff = { id: string; name: string; role: string };
type Participant = { investorId: string; amount: number };

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export type OperationInitialValues = {
  name: string;
  category: string;
  business: string | null;
  description: string | null;
  responsibleId: string | null;
  riskLevel: string;
  capitalUsed: number;
  expectedReturn: number;
  startDate: string; // yyyy-mm-dd
  durationMonths: number;
  isDailyLoan: boolean;
  frequency: LoanFrequency;
  termDays: number;
  dailyAmount: number;
  collectWeekdays: number[];
  borrowerName: string | null;
  borrowerPhone: string | null;
  participants: Participant[];
};

export function OperationForm({
  investors,
  staff,
  initialCategory = "COMMERCIAL",
  mode = "create",
  operationId,
  initialValues,
  locked = false,
}: {
  investors: Investor[];
  staff: Staff[];
  initialCategory?: string;
  mode?: "create" | "edit";
  operationId?: string;
  initialValues?: OperationInitialValues;
  locked?: boolean;
}) {
  const isEdit = mode === "edit";
  const submitAction =
    isEdit && operationId
      ? updateOperation.bind(null, operationId)
      : createOperation;
  const [state, action] = useActionState<OperationFormState, FormData>(
    submitAction,
    {},
  );
  const fe = state.fieldErrors ?? {};

  const today = new Date().toISOString().slice(0, 10);

  // Tipo de operación. Si es "Préstamos" el formulario se simplifica.
  const [category, setCategory] = useState(
    initialValues?.category ?? initialCategory,
  );
  const isLoan = category === "LOANS";

  // Estado del formulario para el preview financiero en vivo
  const [capitalUsed, setCapitalUsed] = useState(
    initialValues?.capitalUsed ?? 0,
  );
  const [expectedReturn, setExpectedReturn] = useState(
    initialValues?.expectedReturn ?? 20,
  );
  const [duration, setDuration] = useState(initialValues?.durationMonths ?? 3);
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? today);
  const [participants, setParticipants] = useState<Participant[]>(
    initialValues?.participants ?? [],
  );

  // Secciones opcionales del modo préstamo
  const [showDescription, setShowDescription] = useState(
    !!initialValues?.description,
  );
  const [showAdvanced, setShowAdvanced] = useState(
    (initialValues?.participants?.length ?? 0) > 0,
  );

  // Cobro diario (préstamos en cuotas). En un préstamo siempre va activo.
  const [isDailyLoan, setIsDailyLoan] = useState(
    initialValues?.isDailyLoan ?? false,
  );
  const dailyOn = isLoan || isDailyLoan;
  // Frecuencia del plan de cobro.
  const [frequency, setFrequency] = useState<LoanFrequency>(
    initialValues?.frequency ?? "DAILY",
  );
  const isDailyFreq = frequency === "DAILY";
  // Días y monto por cuota son campos ENLAZADOS: el último que edites manda y el
  // otro se calcula solo (días → monto = total/días; monto → días derivados).
  const [lastEdited, setLastEdited] = useState<"TERM" | "DAILY_AMOUNT">("TERM");
  const [termDays, setTermDays] = useState(initialValues?.termDays ?? 24);
  const [dailyAmount, setDailyAmount] = useState(
    initialValues?.dailyAmount ?? 25000,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    initialValues?.collectWeekdays ?? [...DEFAULT_COLLECT_WEEKDAYS],
  );
  const [borrowerName, setBorrowerName] = useState(
    initialValues?.borrowerName ?? "",
  );
  const [borrowerPhone, setBorrowerPhone] = useState(
    initialValues?.borrowerPhone ?? "",
  );

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  // Calendario de cobro diario en vivo (espejo de lo que se guardará). El campo
  // que el usuario editó por última vez es el que manda en el cálculo.
  const dailySchedule = useMemo(() => {
    if (!dailyOn || capitalUsed <= 0) return null;
    if (lastEdited === "TERM" ? termDays <= 0 : dailyAmount <= 0) return null;
    const [y, m, d] = startDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    return buildLoanSchedule({
      capital: capitalUsed,
      returnPct: expectedReturn,
      startDate: new Date(y, m - 1, d),
      frequency,
      termDays,
      collectWeekdays: weekdays,
      mode: lastEdited,
      dailyAmount,
    });
  }, [
    dailyOn,
    capitalUsed,
    expectedReturn,
    termDays,
    weekdays,
    startDate,
    lastEdited,
    dailyAmount,
    frequency,
  ]);

  // Valores mostrados en cada campo: el editado muestra lo que escribiste; el
  // otro muestra el valor derivado del calendario en vivo.
  const daysFieldValue =
    lastEdited === "TERM" ? termDays || "" : dailySchedule?.daysCount || "";
  const amountFieldValue =
    lastEdited === "DAILY_AMOUNT"
      ? dailyAmount || ""
      : dailySchedule?.dailyAmount || "";

  const participantsTotal = participants.reduce((s, p) => s + p.amount, 0);
  const companyShare = Math.max(capitalUsed - participantsTotal, 0);
  const exceedsCapital = participantsTotal > capitalUsed;
  const projectedReturn = capitalUsed * (1 + expectedReturn / 100);
  const projectedProfit = projectedReturn - capitalUsed;
  // Total a cobrar del préstamo: del calendario si existe, si no estimado.
  const loanTotal = dailySchedule?.total ?? Math.round(projectedReturn);
  const loanProfit = loanTotal - capitalUsed;

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

  // ----- Bloques reutilizables (cierran sobre el state) -----

  const categorySelect = (
    <div className="space-y-2">
      <Label htmlFor="category">Categoría</Label>
      <select
        id="category"
        name="category"
        className={selectClass}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        disabled={locked}
        required
      >
        {OPERATION_CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const riskSelect = (
    <div className="space-y-2">
      <Label htmlFor="riskLevel">Nivel de riesgo</Label>
      <select
        id="riskLevel"
        name="riskLevel"
        className={selectClass}
        defaultValue={initialValues?.riskLevel ?? "MEDIUM"}
        required
      >
        {Object.entries(RISK_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      {isLoan && (
        <p className="text-xs text-muted-foreground">
          Qué tan confiable es el deudor.
        </p>
      )}
    </div>
  );

  const capitalField = (
    <div className="space-y-2">
      <Label htmlFor="capitalUsed">
        {isLoan ? "Monto prestado (CLP)" : "Capital utilizado (CLP)"}
      </Label>
      <MoneyInput
        id="capitalUsed"
        name="capitalUsed"
        value={capitalUsed}
        onValueChange={setCapitalUsed}
        disabled={locked}
        required
      />
      {fe.capitalUsed && (
        <p className="text-xs text-destructive">{fe.capitalUsed}</p>
      )}
    </div>
  );

  const returnField = (
    <div className="space-y-2">
      <Label htmlFor="expectedReturn">
        {isLoan ? "Interés (%)" : "Retorno esperado (%)"}
      </Label>
      <Input
        id="expectedReturn"
        name="expectedReturn"
        type="number"
        min="0"
        max="500"
        step="0.5"
        value={expectedReturn}
        onChange={(e) => setExpectedReturn(Number(e.target.value))}
        disabled={locked}
        required
      />
    </div>
  );

  const startDateField = (
    <div className="space-y-2">
      <Label htmlFor="startDate">Fecha de inicio</Label>
      <Input
        id="startDate"
        name="startDate"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        disabled={locked}
        required
      />
    </div>
  );

  const borrowerFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="borrowerName">Cliente / deudor</Label>
        <Input
          id="borrowerName"
          value={borrowerName}
          onChange={(e) => setBorrowerName(e.target.value)}
          placeholder="Ej. Juan Pérez"
          required={isLoan}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="borrowerPhone">Teléfono del deudor</Label>
        <Input
          id="borrowerPhone"
          value={borrowerPhone}
          onChange={(e) => setBorrowerPhone(e.target.value)}
          placeholder="Ej. +56 9 1234 5678"
        />
      </div>
    </div>
  );

  // Frecuencia del plan de cobro (botones tipo "días que se cobra").
  const frequencySelector = (
    <div className="space-y-2">
      <Label>Frecuencia de cobro</Label>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["DAILY", "Diario"],
            ["WEEKLY", "Semanal"],
            ["BIWEEKLY", "Quincenal"],
            ["MONTHLY", "Mensual"],
          ] as const
        ).map(([value, label]) => {
          const on = frequency === value;
          return (
            <button
              key={value}
              type="button"
              disabled={locked}
              onClick={() => setFrequency(value)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                on
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Cada cuánto se cobra una cuota.
      </p>
    </div>
  );

  // Días ↔ monto por cuota (enlazados)
  const linkedFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="dailyTermDays">
          {isDailyFreq ? "Días de cobro" : "N° de cuotas"}
        </Label>
        <Input
          id="dailyTermDays"
          type="number"
          min="1"
          max="365"
          value={daysFieldValue}
          disabled={locked}
          onChange={(e) => {
            setTermDays(Number(e.target.value));
            setLastEdited("TERM");
          }}
        />
        <p className="text-xs text-muted-foreground">
          {isDailyFreq
            ? "Cuántas cuotas diarias. Al cambiarlo se recalcula el monto."
            : "Cuántas cuotas. Al cambiarlo se recalcula el monto."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dailyAmount">Monto por cuota (CLP)</Label>
        <MoneyInput
          id="dailyAmount"
          value={Number(amountFieldValue) || 0}
          disabled={locked}
          onValueChange={(v) => {
            setDailyAmount(v);
            setLastEdited("DAILY_AMOUNT");
          }}
        />
        <p className="text-xs text-muted-foreground">
          {isDailyFreq ? "Lo que cobras cada día." : "Lo que cobras por cuota."}{" "}
          Al fijarlo se recalculan las cuotas y el resto queda en una de cierre.
        </p>
      </div>
    </div>
  );

  const weekdaysSelector = !isDailyFreq ? null : (
    <div className="space-y-2">
      <Label>Días que se cobra</Label>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const on = weekdays.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={locked}
              onClick={() => toggleWeekday(day)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                on
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {WEEKDAY_SHORT[day]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Desmarca los días que no cobras (ej. domingos). Las cuotas saltan esos
        días.
      </p>
    </div>
  );

  const schedulePreview =
    dailySchedule && dailySchedule.installments.length > 0 ? (
      <div className="rounded-lg border border-gold/30 bg-gold/[0.03] p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewMini
            label="Total a cobrar"
            value={formatCurrency(dailySchedule.total)}
          />
          <PreviewMini
            label={isDailyFreq ? "Cuota diaria" : "Monto por cuota"}
            value={formatCurrency(dailySchedule.dailyAmount)}
            accent
          />
          <PreviewMini
            label={isDailyFreq ? "Días de cobro" : "N° de cuotas"}
            value={`${dailySchedule.daysCount}`}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Primer cobro {formatDate(dailySchedule.firstDate)} · último{" "}
          {formatDate(dailySchedule.endDate)}.{" "}
          {lastEdited === "DAILY_AMOUNT"
            ? "Cuotas redondas; la última es la de cierre con el resto."
            : "La última cuota ajusta el redondeo."}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dailySchedule.installments.slice(0, 5).map((c) => (
            <span
              key={c.sequence}
              className="rounded border border-border bg-card/60 px-2 py-1 text-xs text-muted-foreground"
            >
              #{c.sequence} {formatDate(c.dueDate)} · {formatCurrency(c.amount)}
            </span>
          ))}
          {dailySchedule.installments.length > 5 && (
            <span className="px-2 py-1 text-xs text-muted-foreground">
              +{dailySchedule.installments.length - 5} más…
            </span>
          )}
        </div>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">
        Ingresa monto, interés y días/monto por cuota para ver el calendario.
      </p>
    );

  // Inputs ocultos del plan de cobro (datos enviados al servidor).
  const dailyHiddenInputs = (
    <>
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="dailyMode" value={lastEdited} />
      <input type="hidden" name="dailyTermDays" value={termDays || ""} />
      <input type="hidden" name="dailyAmount" value={dailyAmount || ""} />
      <input type="hidden" name="collectWeekdays" value={weekdays.join(",")} />
      <input type="hidden" name="borrowerName" value={borrowerName} />
      <input type="hidden" name="borrowerPhone" value={borrowerPhone} />
    </>
  );

  const participantsCard = (
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
          disabled={locked}
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
                disabled={locked}
                onChange={(e) =>
                  updateParticipant(idx, { investorId: e.target.value })
                }
              >
                <option value="">Selecciona…</option>
                {investors.map((inv) => (
                  <option
                    key={inv.id}
                    value={inv.id}
                    disabled={participants.some(
                      (other, i) => i !== idx && other.investorId === inv.id,
                    )}
                  >
                    {inv.fullName} ({formatCurrency(inv.investedCapital)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aporte (CLP)</Label>
              <MoneyInput
                value={p.amount}
                disabled={locked}
                onValueChange={(v) => updateParticipant(idx, { amount: v })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeParticipant(idx)}
              disabled={locked}
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
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {locked && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              Este préstamo ya tiene cobros registrados, así que el monto, las
              fechas, las cuotas y la frecuencia están bloqueados. Para
              corregirlos, primero revierte los cobros (botón ↩ en cada cuota
              cobrada) y vuelve a editar. Por ahora puedes cambiar cliente,
              teléfono, riesgo y nota.
            </span>
          </div>
        )}
        {isLoan ? (
          /* ===================== MODO PRÉSTAMO ===================== */
          <>
            <Card>
              <CardHeader>
                <CardTitle>Datos del préstamo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {borrowerFields}
                <div className="grid gap-4 sm:grid-cols-2">
                  {capitalField}
                  {returnField}
                  {startDateField}
                  {riskSelect}
                  {categorySelect}
                </div>
                {showDescription ? (
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={2}
                      placeholder="Nota sobre el préstamo…"
                      defaultValue={initialValues?.description ?? ""}
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowDescription(true)}
                  >
                    <Plus className="size-4" /> Agregar descripción
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-gold/30">
              <CardHeader className="flex-row items-center gap-2">
                <CalendarClock className="size-5 text-gold" />
                <CardTitle>Plan de cobro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {frequencySelector}
                {linkedFields}
                {weekdaysSelector}
                {schedulePreview}
                {dailyHiddenInputs}
              </CardContent>
            </Card>

            {/* Opciones avanzadas: inversionistas (plegado) */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
                Opciones avanzadas
              </Button>
              {showAdvanced && participantsCard}
            </div>
          </>
        ) : (
          /* ===================== MODO GENÉRICO ===================== */
          <>
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
                    defaultValue={initialValues?.name ?? ""}
                    required
                  />
                  {fe.name && (
                    <p className="text-xs text-destructive">{fe.name}</p>
                  )}
                </div>

                {categorySelect}

                <div className="space-y-2">
                  <Label htmlFor="business">Negocio asociado</Label>
                  <Input
                    id="business"
                    name="business"
                    placeholder="Ej. Sucursal Maipú"
                    defaultValue={initialValues?.business ?? ""}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    placeholder="Detalle de la operación…"
                    defaultValue={initialValues?.description ?? ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsibleId">Responsable</Label>
                  <select
                    id="responsibleId"
                    name="responsibleId"
                    className={selectClass}
                    defaultValue={initialValues?.responsibleId ?? ""}
                  >
                    <option value="">— Sin asignar —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {riskSelect}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capital y plazos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {capitalField}
                {returnField}

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

                {startDateField}

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

            {/* Cobro diario (préstamos en cuotas) */}
            <Card className={isDailyLoan ? "border-gold/30" : undefined}>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-5 text-gold" />
                  <CardTitle>Cobro diario</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isDailyLoan ? "Activado" : "Desactivado"}
                  </span>
                  <Switch
                    checked={isDailyLoan}
                    onCheckedChange={setIsDailyLoan}
                    aria-label="Activar cobro diario"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isDailyLoan ? (
                  <p className="text-sm text-muted-foreground">
                    Actívalo para cobrar este préstamo en cuotas diarias. El
                    total (capital + interés) se divide en los días que elijas y
                    se genera el calendario de cobranza automáticamente.
                  </p>
                ) : (
                  <>
                    {frequencySelector}
                    {linkedFields}
                    {borrowerFields}
                    {weekdaysSelector}
                    {schedulePreview}
                    {dailyHiddenInputs}
                  </>
                )}
              </CardContent>
            </Card>

            {participantsCard}
          </>
        )}

        {/* Hidden inputs comunes / del modo préstamo */}
        <input
          type="hidden"
          name="isDailyLoan"
          value={dailyOn ? "true" : "false"}
        />
        {isLoan && (
          <>
            <input
              type="hidden"
              name="name"
              value={`Préstamo a ${borrowerName}`}
            />
            <input type="hidden" name="status" value="ACTIVE" />
          </>
        )}

        {state.error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-2">
          <SubmitButton
            label={
              isEdit
                ? "Guardar cambios"
                : isLoan
                  ? "Crear préstamo"
                  : "Crear operación"
            }
            pendingLabel={isEdit ? "Guardando…" : "Creando…"}
          />
          <Button asChild variant="outline">
            <Link
              href={
                isEdit && operationId
                  ? `/operaciones/${operationId}`
                  : "/operaciones"
              }
            >
              Cancelar
            </Link>
          </Button>
        </div>
      </div>

      {/* ===================== SIDEBAR ===================== */}
      <div className="space-y-6">
        {isLoan ? (
          <Card className="border-gold/30 bg-gold/[0.03]">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Coins className="size-5 text-gold" />
                <CardTitle>Resumen del préstamo</CardTitle>
              </div>
              <Badge variant="gold" className="w-fit text-[10px]">
                Así moverá el dinero
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Cliente" value={borrowerName || "—"} />
              <Row label="Monto prestado" value={formatCurrency(capitalUsed)} />
              <Row
                label="Total a cobrar"
                value={formatCurrency(loanTotal)}
                accent
              />
              <Row
                label="Ganancia"
                value={formatCurrency(loanProfit)}
                hint={`+${expectedReturn}% de interés`}
              />
              <div className="gold-rule" />
              <Row
                label="N° de cuotas"
                value={dailySchedule ? `${dailySchedule.daysCount}` : "—"}
              />
              <Row
                label="Cuota diaria"
                value={
                  dailySchedule
                    ? formatCurrency(dailySchedule.dailyAmount)
                    : "—"
                }
                accent
              />
              {dailySchedule && (
                <Row
                  label="Cobro"
                  value={`${formatDate(dailySchedule.firstDate)} → ${formatDate(dailySchedule.endDate)}`}
                />
              )}
              <div className="rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
                <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
                  <TrendingUp className="size-3.5 text-gold" /> Qué pasará al
                  crearlo
                </p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>
                    Baja la liquidez disponible en {formatCurrency(capitalUsed)}
                  </li>
                  {dailySchedule && (
                    <li>
                      Se generan {dailySchedule.daysCount} cuotas de{" "}
                      {formatCurrency(dailySchedule.dailyAmount)}
                    </li>
                  )}
                  <li>Queda como préstamo activo a nombre del cliente</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
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
              <Row
                label="Capital comprometido"
                value={formatCurrency(capitalUsed)}
                accent
              />
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
                  <li>
                    Baja la liquidez disponible en {formatCurrency(capitalUsed)}
                  </li>
                  <li>
                    Sube el capital comprometido en{" "}
                    {formatCurrency(capitalUsed)}
                  </li>
                  <li>Se registra un movimiento tipo "Comprometido"</li>
                  <li>Cada participante queda vinculado con su aporte</li>
                  {isDailyLoan && dailySchedule && (
                    <li>
                      Se generan {dailySchedule.daysCount} cuotas de{" "}
                      {formatCurrency(dailySchedule.dailyAmount)} para cobro
                      diario
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </form>
  );
}

function PreviewMini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`font-display text-base font-semibold tabular ${
          accent ? "text-gold" : ""
        }`}
      >
        {value}
      </p>
    </div>
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
