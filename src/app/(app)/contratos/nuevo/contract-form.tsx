"use client";

import { useActionState, useState, useMemo } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, AlertCircle, Calculator } from "lucide-react";
import { createContract, type ContractFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { PAYMENT_FREQUENCY_OPTIONS } from "@/lib/constants";
import { buildSchedule, type PaymentFrequency } from "@/lib/payments";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Fecha de hoy en formato yyyy-mm-dd (hora local, sin desfase UTC). */
function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Generando…" : "Generar contrato"}
    </Button>
  );
}

export interface ContractTemplateDefaults {
  modality: string;
  paymentFrequency: string;
  returnRate: number | null;
  durationMonths: number | null;
  customIntervalMonths: number | null;
  periodicInterestPct: number;
}

export function ContractForm({
  investors,
  preselected,
  template,
}: {
  investors: { id: string; fullName: string }[];
  preselected?: string;
  template?: ContractTemplateDefaults;
}) {
  const [state, action] = useActionState<ContractFormState, FormData>(
    createContract,
    {},
  );
  const fe = state.fieldErrors ?? {};

  const [amount, setAmount] = useState(0);
  const [rate, setRate] = useState(template?.returnRate ?? 12);
  // La tasa se guarda SIEMPRE como anual; "MONTHLY" solo cambia cómo la ingresa
  // el usuario (×12 para obtener la anual equivalente).
  const [rateMode, setRateMode] = useState<"ANNUAL" | "MONTHLY">("ANNUAL");
  const annualRate = rateMode === "MONTHLY" ? rate * 12 : rate;
  const [duration, setDuration] = useState(template?.durationMonths ?? 12);
  const [startDate, setStartDate] = useState(todayISO);
  // Fechas en hora local; la de término se calcula sola: inicio + duración.
  const { startObj, endDate } = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return { startObj: null, endDate: null };
    const end = new Date(start);
    end.setMonth(end.getMonth() + Math.max(Math.round(duration), 1));
    return { startObj: start, endDate: end };
  }, [startDate, duration]);
  const [frequency, setFrequency] = useState<PaymentFrequency>(
    (template?.paymentFrequency as PaymentFrequency) || "MONTHLY",
  );
  const [customInterval, setCustomInterval] = useState(
    template?.customIntervalMonths ?? 1,
  );
  const [periodicPct, setPeriodicPct] = useState(
    template?.periodicInterestPct ?? 50,
  );
  const defaultModality = template?.modality ?? "FIXED";

  const schedule = useMemo(
    () =>
      buildSchedule({
        amount,
        annualRate,
        durationMonths: duration,
        frequency,
        customIntervalMonths: frequency === "CUSTOM" ? customInterval : undefined,
        periodicInterestPct:
          frequency === "CUSTOM"
            ? periodicPct
            : frequency === "AT_MATURITY"
              ? 0
              : 100,
      }),
    [amount, annualRate, duration, frequency, customInterval, periodicPct],
  );

  // Para la mini-tabla: muestra hasta 4 cuotas + el pago final.
  const previewRows = useMemo(() => {
    const items = schedule.payments;
    if (items.length <= 6) return items;
    return [...items.slice(0, 3), null, ...items.slice(-2)] as const;
  }, [schedule.payments]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="investorId">Inversionista</Label>
              <select
                id="investorId"
                name="investorId"
                className={selectClass}
                defaultValue={preselected ?? ""}
                required
              >
                <option value="" disabled>
                  Selecciona un inversionista…
                </option>
                {investors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.fullName}
                  </option>
                ))}
              </select>
              {fe.investorId && (
                <p className="text-xs text-destructive">{fe.investorId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto del contrato (CLP)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="1000"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
              {fe.amount && <p className="text-xs text-destructive">{fe.amount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnRateInput">
                Retorno estimado {rateMode === "MONTHLY" ? "mensual" : "anual"} (%)
              </Label>
              {/* La tasa anual es lo que se guarda y valida en el servidor. */}
              <input type="hidden" name="returnRate" value={annualRate} />
              <div className="flex gap-2">
                <Input
                  id="returnRateInput"
                  type="number"
                  min="0"
                  max={rateMode === "MONTHLY" ? "100" : "1000"}
                  step="0.5"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  required
                />
                <select
                  aria-label="Periodicidad de la tasa"
                  className={`${selectClass} w-auto shrink-0`}
                  value={rateMode}
                  onChange={(e) =>
                    setRateMode(e.target.value as "ANNUAL" | "MONTHLY")
                  }
                >
                  <option value="ANNUAL">Anual</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                {rateMode === "MONTHLY"
                  ? `Equivale a ${annualRate.toLocaleString("es-CL")}% anual`
                  : `Equivale a ${(annualRate / 12).toLocaleString("es-CL", { maximumFractionDigits: 2 })}% mensual`}
              </p>
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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {endDate
                  ? `Termina el ${formatDate(endDate)}`
                  : "Fecha inválida"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modality">Modalidad</Label>
              <select id="modality" name="modality" className={selectClass} defaultValue={defaultModality}>
                <option value="FIXED">Renta fija</option>
                <option value="VARIABLE">Renta variable</option>
                <option value="PARTICIPATION">Participación</option>
              </select>
            </div>

            {/* Frecuencia de pago */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="paymentFrequency">Frecuencia de pago</Label>
              <select
                id="paymentFrequency"
                name="paymentFrequency"
                className={selectClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}
              >
                {PAYMENT_FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {frequency === "MONTHLY" &&
                  "Paga interés cada mes y devuelve el capital al vencimiento."}
                {frequency === "QUARTERLY" &&
                  "Paga interés cada 3 meses y devuelve el capital al vencimiento."}
                {frequency === "AT_MATURITY" &&
                  "No paga nada durante el contrato. Al vencimiento entrega capital + interés total acumulado."}
                {frequency === "CUSTOM" &&
                  "Modelo mixto: paga una fracción del interés en cada período y acumula el resto para entregarlo con el capital al final."}
              </p>
            </div>

            {/* Inputs adicionales para CUSTOM */}
            {frequency === "CUSTOM" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="customIntervalMonths">
                    Cada cuántos meses se paga
                  </Label>
                  <Input
                    id="customIntervalMonths"
                    name="customIntervalMonths"
                    type="number"
                    min="1"
                    max={duration}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodicInterestPct">
                    % del interés pagado por período
                  </Label>
                  <Input
                    id="periodicInterestPct"
                    name="periodicInterestPct"
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={periodicPct}
                    onChange={(e) => setPeriodicPct(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    El resto (
                    {formatPercent(100 - periodicPct, 0)}) se acumula y se paga
                    al vencimiento junto con el capital.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="conditions">Condiciones</Label>
              <Textarea
                id="conditions"
                name="conditions"
                rows={4}
                placeholder="Condiciones particulares del contrato…"
              />
            </div>
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
            <Link href="/contratos">Cancelar</Link>
          </Button>
        </div>
      </div>

      {/* Simulación financiera — usa la misma función que el calendario real */}
      <div className="space-y-6">
        <Card className="border-gold/30 bg-gold/[0.03]">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Calculator className="size-5 text-gold" />
              <CardTitle>Simulación financiera</CardTitle>
            </div>
            <Badge variant="gold" className="w-fit text-[10px]">
              {schedule.modelLabel}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Capital" value={formatCurrency(amount)} />
            <Row label="Retorno estimado anual" value={formatPercent(annualRate)} />
            <Row
              label="Equivale mensual"
              value={formatPercent(annualRate / 12, 2)}
            />
            <Row label="Plazo" value={`${duration} meses`} />
            <Row
              label="Vigencia"
              value={
                startObj && endDate
                  ? `${formatDate(startObj)} → ${formatDate(endDate)}`
                  : "—"
              }
            />
            <div className="gold-rule" />
            {schedule.periodCount > 0 && (
              <>
                <Row
                  label={`Cuota periódica (${schedule.periodCount}×)`}
                  value={formatCurrency(schedule.periodicAmount)}
                  accent
                />
              </>
            )}
            <Row
              label="Pago al vencimiento"
              value={formatCurrency(
                schedule.totalCapital + schedule.accruedAtMaturity,
              )}
              accent
              hint={
                schedule.accruedAtMaturity > 0
                  ? `Capital ${formatCurrency(schedule.totalCapital)} + interés ${formatCurrency(schedule.accruedAtMaturity)}`
                  : `Capital ${formatCurrency(schedule.totalCapital)}`
              }
            />
            <div className="gold-rule" />
            <Row
              label="Interés total"
              value={formatCurrency(schedule.totalInterest)}
            />
            <Row
              label="Total a devolver"
              value={formatCurrency(schedule.totalToReturn)}
              accent
            />

            {/* Mini-calendario */}
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Calendario ({schedule.payments.length} cuotas)
              </p>
              <ul className="space-y-1 text-xs">
                {previewRows.map((p, idx) =>
                  p === null ? (
                    <li key={`gap-${idx}`} className="text-center text-muted-foreground">
                      ⋮
                    </li>
                  ) : (
                    <li
                      key={`${p.monthOffset}-${p.type}-${idx}`}
                      className="flex items-center justify-between"
                    >
                      <span className="text-muted-foreground">
                        Mes {p.monthOffset} · {p.label}
                      </span>
                      <span
                        className={
                          p.type === "CAPITAL_RETURN"
                            ? "font-medium tabular text-gold"
                            : "font-medium tabular"
                        }
                      >
                        {formatCurrency(p.amount)}
                      </span>
                    </li>
                  ),
                )}
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
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={
            accent ? "font-semibold text-gold tabular" : "font-medium tabular"
          }
        >
          {value}
        </span>
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
