import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  delta?: { value: string; positive?: boolean };
  accent?: "gold" | "emerald" | "neutral" | "danger";
}

const ACCENTS: Record<string, string> = {
  gold: "text-gold bg-gold/10 border-gold/20",
  emerald: "text-[hsl(var(--emerald))] bg-emerald/10 border-emerald/20",
  neutral: "text-muted-foreground bg-secondary border-border",
  danger: "text-[hsl(var(--danger))] bg-[hsl(var(--danger))]/10 border-[hsl(var(--danger))]/20",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  accent = "neutral",
}: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border",
            ACCENTS[accent],
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              delta.positive
                ? "text-[hsl(var(--success))]"
                : "text-[hsl(var(--danger))]",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {delta.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
