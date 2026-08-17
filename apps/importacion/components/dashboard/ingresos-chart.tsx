"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IngresoMensual } from "@/lib/data/dashboard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

type IngresosChartProps = {
  data: IngresoMensual[];
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-zinc-400">{label}</p>
      <p className="font-semibold text-zinc-100">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function IngresosChart({ data }: IngresosChartProps) {
  const hasData = data.some((item) => item.total > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Sin ingresos registrados en los últimos 6 meses
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fill: "#71717a", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatCurrencyCompact(value)}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59, 130, 246, 0.08)" }} />
          <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
