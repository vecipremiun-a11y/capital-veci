"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";

export function LiquiditySimulator({
  totalCapital,
  capitalWorking,
  reserves,
  minLiquidity,
  maxCommitment,
}: {
  totalCapital: number;
  capitalWorking: number;
  reserves: number;
  minLiquidity: number;
  maxCommitment: number;
}) {
  const [extraCommit, setExtraCommit] = useState(0);
  const [releaseReserve, setReleaseReserve] = useState(0);

  const newWorking = capitalWorking + extraCommit;
  const newReserves = Math.max(reserves - releaseReserve, 0);
  const newAvailable = totalCapital - newWorking - newReserves;
  const newCommitmentRatio =
    totalCapital > 0 ? (newWorking / totalCapital) * 100 : 0;
  const newLiquidityRatio =
    totalCapital > 0 ? (newAvailable / totalCapital) * 100 : 0;

  const breachesMin = newAvailable < minLiquidity;
  const breachesMax = newCommitmentRatio > maxCommitment;
  const safe = !breachesMin && !breachesMax && newAvailable >= 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="commit">Comprometer capital adicional</Label>
          <MoneyInput
            id="commit"
            value={extraCommit}
            onValueChange={setExtraCommit}
            placeholder="Ej: 50.000.000"
          />
          <p className="text-xs text-muted-foreground">
            Simula el impacto de una nueva operación o aumento de inversión.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="release">Liberar reservas</Label>
          <MoneyInput
            id="release"
            value={releaseReserve}
            onValueChange={setReleaseReserve}
          />
        </div>

        <div>
          <Badge
            variant={safe ? "success" : breachesMin ? "danger" : "warning"}
            className="text-xs"
          >
            {safe
              ? "Escenario dentro de los límites de seguridad"
              : breachesMin
                ? "Quedaría bajo el mínimo de liquidez exigido"
                : "Superaría el límite máximo de compromiso"}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Capital comprometido (escenario)
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-medium tabular">
              {formatCurrency(newWorking)}
            </span>
            <span className="text-xs text-muted-foreground tabular">
              {formatPercent(newCommitmentRatio)}
            </span>
          </div>
          <Progress
            value={Math.min(newCommitmentRatio, 100)}
            className="mt-2"
            indicatorClassName={
              breachesMax ? "bg-[hsl(var(--danger))]" : "bg-gold"
            }
          />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Liquidez disponible (escenario)
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span
              className={`font-medium tabular ${
                breachesMin ? "text-[hsl(var(--danger))]" : ""
              }`}
            >
              {formatCurrency(newAvailable)}
            </span>
            <span className="text-xs text-muted-foreground tabular">
              {formatPercent(newLiquidityRatio)}
            </span>
          </div>
          <Progress
            value={Math.min(Math.max(newLiquidityRatio, 0), 100)}
            className="mt-2"
            indicatorClassName={
              breachesMin ? "bg-[hsl(var(--danger))]" : "bg-emerald"
            }
          />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Reservas (escenario)</p>
          <p className="mt-1 font-medium tabular">
            {formatCurrency(newReserves)}
          </p>
        </div>
      </div>
    </div>
  );
}
