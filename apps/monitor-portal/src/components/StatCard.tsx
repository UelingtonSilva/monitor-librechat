import type { LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  /** Optional delta, shown only when a real comparison is available. */
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  /** Real historical series. With no real data the sparkline is simply not rendered — never
   *  invent a trend to fill the space. */
  trend?: number[];
  /** When present the tile becomes clickable and gains a discreet chevron, signalling there
   *  is more behind the number. */
  onClick?: () => void;
}

const CHANGE_COLOR = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  change,
  changeType = "neutral",
  trend,
  onClick,
}: StatCardProps) {
  const trendData = trend?.map((v) => ({ v }));

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`kpi-card flex flex-col gap-0.5 text-left ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{label}</p>
        <div className="flex shrink-0 items-center gap-1">
          {Icon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon size={13} strokeWidth={2.25} />
            </span>
          )}
          {onClick && <ChevronRight size={13} className="text-muted-foreground" />}
        </div>
      </div>
      <p className="tnum text-xl font-bold leading-tight text-foreground">{value}</p>
      <div className="flex items-center gap-1.5 text-xs">
        {change && <span className={`font-medium ${CHANGE_COLOR[changeType]}`}>{change}</span>}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
      {trendData && trendData.length > 1 && (
        <div className="-mx-1 -mb-1 mt-0.5 h-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
