"use client";

/**
 * Burndown chart — client component (recharts requires client runtime;
 * importing recharts in a Server Component crashes at module eval:
 * "createContext is not a function").
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface BurndownChartPoint {
  day: string;
  remaining: number;
  ideal?: number;
}

export default function BurndownChart({ data }: { data: BurndownChartPoint[] }) {
  return (
    <div className="h-[140px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="burndownFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={30} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="remaining"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#burndownFill)"
            name="برآورد باقی‌مانده"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
