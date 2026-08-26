import { Landmark, HandCoins, Briefcase, Building2 } from "lucide-react";
import type { CapitalAllocation } from "@/lib/data/staff-capital";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * Dónde está la plata del fondo ahora mismo, con el foco puesto en lo que
 * todavía no está asignado a nadie.
 */
export function CapitalAllocationCard({ data }: { data: CapitalAllocation }) {
  const total = data.totalCapital;
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  const slices = [
    {
      icon: HandCoins,
      label: "En manos de trabajadores",
      value: data.inCustody,
      hint: `${formatCurrency(data.workerPlaced)} ya colocados en sus préstamos`,
      bar: "bg-gold",
    },
    {
      icon: Briefcase,
      label: "Colocado por la empresa",
      value: data.companyPlaced,
      hint: "Préstamos financiados directo desde la caja",
      bar: "bg-[hsl(var(--warning))]",
    },
    {
      icon: Building2,
      label: "Sin asignar",
      value: data.unassigned,
      hint: `Reserva exigida ${formatCurrency(data.reserves)} (${formatPercent(data.reservePercentage, 0)})`,
      bar: "bg-[hsl(var(--success))]",
      highlight: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle>Capital del fondo</CardTitle>
            <CardDescription>
              Dónde está la plata hoy · total {formatCurrency(total)}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Libre para asignar
            </p>
            <p
              className={
                data.freeToAssign < 0
                  ? "font-display text-3xl font-semibold tabular text-[hsl(var(--danger))]"
                  : "font-display text-3xl font-semibold tabular text-gold"
              }
            >
              {formatCurrency(data.freeToAssign)}
            </p>
            <p className="text-xs text-muted-foreground">
              Sin asignar menos la reserva
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {slices.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className={s.highlight ? "font-medium" : ""}>
                    {s.label}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular">
                    {formatPercent(pct(s.value), 1)}
                  </span>
                  <span
                    className={
                      s.highlight
                        ? "font-semibold tabular text-gold"
                        : "font-medium tabular"
                    }
                  >
                    {formatCurrency(s.value)}
                  </span>
                </span>
              </div>
              <Progress
                value={Math.max(Math.min(pct(s.value), 100), 0)}
                indicatorClassName={s.bar}
              />
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
          );
        })}

        {data.freeToAssign < 0 && data.unassigned >= 0 && (
          <div className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-3 py-2 text-xs text-[hsl(var(--warning))]">
            Te quedan {formatCurrency(data.unassigned)} sin asignar, pero tu
            política exige {formatCurrency(data.reserves)} de reserva: ya
            repartiste {formatCurrency(Math.abs(data.freeToAssign))} de más.
            Baja el % de reservas en Configuración o pide que te devuelvan
            efectivo antes de entregar más.
          </div>
        )}

        {data.unassigned < 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            El capital sin asignar salió negativo: hay más plata entregada y
            colocada que capital en el fondo. Revisa si falta registrar una
            devolución, o si algún préstamo quedó sin responsable y por eso se
            está contando dos veces.
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 p-3 text-xs text-muted-foreground">
          <Landmark className="mt-0.5 size-4 shrink-0" />
          <p>
            Lo que le entregas a un trabajador sale de la caja aunque todavía no
            lo preste. Cuando él cobra una cuota, esa plata vuelve a su bolsillo
            —no a la caja— así que este reparto no se mueve hasta que te
            devuelva efectivo o le entregues más.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
