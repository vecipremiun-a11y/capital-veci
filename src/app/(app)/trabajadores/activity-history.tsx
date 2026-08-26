"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { StaffActivity } from "@/lib/data/staff-capital";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RANGES = [
  { value: "day", label: "Por día" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mes" },
] as const;

type Range = (typeof RANGES)[number]["value"];

/**
 * Historial de cuánto se cobró y cuánto se prestó, agrupado por día, semana
 * o mes. El neto muestra si el efectivo en mano subió o bajó en el período.
 */
export function ActivityHistory({ activity }: { activity: StaffActivity }) {
  const [range, setRange] = useState<Range>("day");
  const rows = activity[range];

  const totals = rows.reduce(
    (acc, r) => ({
      collected: acc.collected + r.collected,
      lent: acc.lent + r.lent,
    }),
    { collected: 0, lent: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Historial de cobros y préstamos</CardTitle>
            <CardDescription>
              {formatCurrency(totals.collected)} cobrados ·{" "}
              {formatCurrency(totals.lent)} prestados
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card/40 p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  range === r.value
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Todavía no hay cobros ni préstamos registrados.
          </p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>
                    {range === "day"
                      ? "Día"
                      : range === "week"
                        ? "Semana"
                        : "Mes"}
                  </TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Prestado</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="whitespace-nowrap font-medium capitalize">
                      {r.label}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {r.collected > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                          <ArrowDownLeft className="size-3.5" />
                          {formatCurrency(r.collected)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {r.lent > 0 ? (
                        <span className="inline-flex items-center gap-1 text-gold">
                          <ArrowUpRight className="size-3.5" />
                          {formatCurrency(r.lent)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular",
                        r.net > 0
                          ? "text-[hsl(var(--success))]"
                          : r.net < 0
                            ? "text-[hsl(var(--danger))]"
                            : "text-muted-foreground",
                      )}
                    >
                      {r.net > 0 ? "+" : ""}
                      {formatCurrency(r.net)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
