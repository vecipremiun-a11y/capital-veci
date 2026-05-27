"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatCurrency } from "@/lib/format";

const GOLD = "hsl(43, 70%, 55%)";
const EMERALD = "hsl(158, 64%, 45%)";
const DANGER = "hsl(0, 72%, 56%)";
const MUTED = "hsl(220, 10%, 45%)";
const GRID = "hsl(222, 14%, 16%)";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-card">
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-sm">
          <span
            className="mr-2 inline-block size-2 rounded-full align-middle"
            style={{ background: entry.color || entry.fill }}
          />
          <span className="text-muted-foreground">{entry.name}: </span>
          <span className="font-medium tabular">
            {formatCurrency(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

const axisProps = {
  stroke: MUTED,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function FlowAreaChart({
  data,
}: {
  data: { month: string; ingresos: number; egresos: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity={0.4} />
            <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gEgresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={56} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="ingresos"
          name="Ingresos"
          stroke={EMERALD}
          strokeWidth={2}
          fill="url(#gIngresos)"
        />
        <Area
          type="monotone"
          dataKey="egresos"
          name="Egresos"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#gEgresos)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CapitalGrowthChart({
  data,
}: {
  data: { month: string; capital: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gCapital" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={56} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="capital"
          name="Capital administrado"
          stroke={GOLD}
          strokeWidth={2.5}
          fill="url(#gCapital)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PaymentsBarChart({
  data,
}: {
  data: { label: string; value: number; key: string }[];
}) {
  const colors: Record<string, string> = {
    PAID: EMERALD,
    PENDING: GOLD,
    OVERDUE: DANGER,
    SCHEDULED: MUTED,
  };
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompact(v)} width={56} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(222,16%,13%)" }} />
        <Bar dataKey="value" name="Monto" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={colors[d.key] ?? MUTED} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LiquidityDonut({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={92}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
