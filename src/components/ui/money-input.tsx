"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatAmountInput, parseAmountInput } from "@/lib/format";

export interface MoneyInputProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> {
  /** Nombre del campo enviado al servidor (siempre como número plano). */
  name?: string;
  /** Monto controlado, en pesos. */
  value?: number;
  /** Monto inicial cuando el campo no está controlado. */
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

/**
 * Campo de monto que separa los miles mientras se escribe: al teclear
 * "9000000" se ve "$9.000.000", así se distingue de un vistazo si son mil o
 * un millón.
 *
 * El input visible es texto (para poder mostrar los puntos) y el valor que
 * viaja en el formulario va en un input oculto como número plano, de modo que
 * las server actions siguen recibiendo exactamente lo mismo de antes.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, name, value, defaultValue, onValueChange, ...props }, ref) => {
    // Un monto en 0 se muestra vacío (igual que antes con el input numérico).
    const [display, setDisplay] = React.useState(() => {
      const initial = value ?? defaultValue ?? 0;
      return initial ? formatAmountInput(initial) : "";
    });
    const typed = parseAmountInput(display);

    // Resincroniza cuando el monto cambia desde fuera (plantillas, cálculos
    // enlazados, reset del formulario).
    React.useEffect(() => {
      if (value == null) return;
      setDisplay((current) =>
        parseAmountInput(current) === value
          ? current
          : formatAmountInput(value),
      );
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const next = formatAmountInput(e.target.value);
      setDisplay(next);
      onValueChange?.(parseAmountInput(next));
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
          $
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          onChange={handleChange}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background/50 py-2 pl-7 pr-3 text-sm tabular shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {name && <input type="hidden" name={name} value={typed || ""} />}
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
