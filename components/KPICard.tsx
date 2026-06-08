import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: string; positive: boolean };
  subtitle?: string;
  active?: boolean;
  onClick?: () => void;
}

export default function KPICard({
  title,
  value,
  icon: Icon,
  iconColor = "text-[#CC2229]",
  iconBg,
  trend,
  subtitle,
  active = false,
  onClick,
}: KPICardProps) {
  const iconBgClass = iconBg ?? "bg-muted";

  const content = (
    <>
      <div className={cn("p-2.5 rounded-xl shrink-0", iconBgClass, iconColor)}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1.5 truncate">
          {title}
        </p>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {subtitle && (
          <p className="text-muted-foreground text-xs mt-1.5">{subtitle}</p>
        )}
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 text-xs font-medium",
              trend.positive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </div>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-start gap-4 rounded-xl border bg-card p-5 text-left transition-all duration-150",
          "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
          active
            ? "border-[#CC2229] shadow-sm shadow-[#CC2229]/10 ring-2 ring-[#CC2229]/10"
            : "border-border shadow-sm hover:border-[#CC2229]/40",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      {content}
    </div>
  );
}
