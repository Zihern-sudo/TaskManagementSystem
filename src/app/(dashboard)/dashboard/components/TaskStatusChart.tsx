"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface StatusCount {
  status: string;
  label: string;
  count: number;
  color: string;
}

const COLORS: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#3b82f6",
  in_review:   "#f59e0b",
  completed:   "#10b981",
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: StatusCount }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700">{item.name}</p>
      <p className="text-slate-500">{item.value} task{item.value !== 1 ? "s" : ""}</p>
    </div>
  );
}

export default function TaskStatusChart({ data }: { data: StatusCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No task data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={COLORS[entry.status] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span className="text-[12px] text-slate-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
