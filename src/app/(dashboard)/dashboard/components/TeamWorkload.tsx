"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface WorkloadItem {
  userId: string;
  name: string;
  tasks: number;
  completed: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.find((p) => p.dataKey === "tasks")?.value ?? 0;
  const done = payload.find((p) => p.dataKey === "completed")?.value ?? 0;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-slate-500">{total} total task{total !== 1 ? "s" : ""}</p>
      <p className="text-emerald-600">{done} completed</p>
    </div>
  );
}

// Truncate long names for the axis
function truncate(name: string, max = 14) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

export default function TeamWorkload({ data }: { data: WorkloadItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No assigned tasks yet
      </div>
    );
  }

  const chartData = [...data]
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 10)
    .map((d) => ({ ...d, shortName: truncate(d.name) }));

  const barHeight = 36;
  const chartHeight = Math.max(200, chartData.length * (barHeight + 12) + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={chartData}
        barSize={barHeight - 8}
        margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
        {/* Background bar = total tasks */}
        <Bar dataKey="tasks" radius={[0, 6, 6, 0]} fill="#e0e7ff">
          {chartData.map((_, i) => (
            <Cell key={i} fill="#e0e7ff" />
          ))}
        </Bar>
        {/* Foreground bar = completed */}
        <Bar dataKey="completed" radius={[0, 6, 6, 0]} fill="#6366f1">
          {chartData.map((_, i) => (
            <Cell key={i} fill="#6366f1" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
