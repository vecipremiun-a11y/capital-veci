"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cleanRut, formatRut, validateRut } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Códigos de país más usados; Chile (+56) por defecto. */
export const COUNTRY_CODES = [
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+51", flag: "🇵🇪", name: "Perú" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "+52", flag: "🇲🇽", name: "México" },
  { code: "+1", flag: "🇺🇸", name: "EE.UU." },
  { code: "+34", flag: "🇪🇸", name: "España" },
] as const;

export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** RUT con formateo en vivo y validación de dígito verificador. */
export function RutInput({
  serverError,
  defaultValue = "",
}: {
  serverError?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(() => formatRut(defaultValue) || "");
  const clean = cleanRut(value);
  const touched = clean.length >= 2;
  const valid = validateRut(value);

  return (
    <div className="space-y-2">
      <Label htmlFor="rut">RUT</Label>
      {/* Valor que se envía y valida en el servidor */}
      <input type="hidden" name="rut" value={value} />
      <div className="relative">
        <Input
          id="rut"
          inputMode="text"
          autoComplete="off"
          placeholder="12.345.678-9"
          value={value}
          required
          aria-invalid={touched && !valid}
          onChange={(e) => setValue(formatRut(e.target.value))}
          className={
            touched
              ? valid
                ? "border-emerald-500/60 pr-9 focus:ring-emerald-500"
                : "border-destructive/70 pr-9 focus:ring-destructive"
              : ""
          }
        />
        {touched && valid && (
          <Check className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
        )}
      </div>
      {touched && !valid ? (
        <p className="text-xs text-destructive">
          RUT inválido: revisa el dígito verificador.
        </p>
      ) : (
        serverError && <p className="text-xs text-destructive">{serverError}</p>
      )}
    </div>
  );
}

/** Separa un teléfono guardado ("+56 9 1234 5678") en código país + número. */
function splitPhone(phone: string): { code: string; number: string } {
  const trimmed = (phone || "").trim();
  if (!trimmed) return { code: "+56", number: "" };
  // Busca el prefijo de país más largo que coincida.
  const match = [...COUNTRY_CODES]
    .map((c) => c.code)
    .sort((a, b) => b.length - a.length)
    .find((code) => trimmed.startsWith(code));
  if (match) {
    return { code: match, number: trimmed.slice(match.length).trim() };
  }
  return { code: "+56", number: trimmed };
}

/** Teléfono con selector de país (+56 Chile por defecto). */
export function PhoneInput({
  serverError,
  defaultValue = "",
}: {
  serverError?: string;
  defaultValue?: string;
}) {
  const initial = splitPhone(defaultValue);
  const [code, setCode] = useState(initial.code);
  const [number, setNumber] = useState(initial.number);
  const combined = number.trim() ? `${code} ${number.trim()}` : "";

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="phoneNumber">Teléfono</Label>
      {/* Valor combinado (código país + número) que recibe el servidor */}
      <input type="hidden" name="phone" value={combined} />
      <div className="flex gap-2">
        <select
          aria-label="Código de país"
          className={cn(selectClass, "w-28 shrink-0 px-2")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code + c.name} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <Input
          id="phoneNumber"
          className="min-w-0 flex-1"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9 1234 5678"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
        />
      </div>
      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
    </div>
  );
}
