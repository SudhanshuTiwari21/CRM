import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  accent: "blue" | "amber" | "rose" | "emerald" | "violet" | "cyan";
  highlight?: boolean;
}

const accentStyles = {
  blue: {
    icon: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
    bar: "from-blue-500 to-blue-600",
    glow: "shadow-blue-500/5",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
    bar: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/5",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 ring-rose-500/20",
    bar: "from-rose-500 to-red-500",
    glow: "shadow-rose-500/5",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
    bar: "from-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/5",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-600 ring-violet-500/20",
    bar: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/5",
  },
  cyan: {
    icon: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20",
    bar: "from-cyan-500 to-sky-500",
    glow: "shadow-cyan-500/5",
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent,
  highlight,
}: KpiCardProps) {
  const styles = accentStyles[accent];
  const TrendIcon =
    trend && trend.value > 0
      ? TrendingUp
      : trend && trend.value < 0
        ? TrendingDown
        : Minus;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        styles.glow,
        highlight && "ring-2 ring-amber-400/50 ring-offset-2"
      )}
    >
      <div className={cn("absolute left-0 top-0 h-1 w-full bg-gradient-to-r opacity-80", styles.bar)} />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                trend.value > 0 && "bg-emerald-500/10 text-emerald-700",
                trend.value < 0 && "bg-rose-500/10 text-rose-700",
                trend.value === 0 && "bg-muted text-muted-foreground"
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {trend.label}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105",
            styles.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
