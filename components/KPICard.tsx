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
  const iconBgClass = iconBg ?? "bg-slate-100 dark:bg-white/8";

  const content = (
    <div className="flex items-start gap-4">
      <div className={cn("p-2.5 rounded-xl shrink-0", iconBgClass, iconColor)}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-1.5 truncate">
          {title}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        {subtitle && (
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1.5">{subtitle}</p>
        )}
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 text-xs font-semibold",
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
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group w-full rounded-2xl border bg-white dark:bg-[#181b20] p-5 text-left transition-all duration-150",
          "shadow-[0_1px_8px_rgba(15,23,42,0.05)] dark:shadow-none",
          "hover:shadow-[0_4px_16px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 cursor-pointer",
          active
            ? "border-[#CC2229] ring-2 ring-[#CC2229]/10"
            : "border-slate-200 dark:border-white/10 hover:border-[#CC2229]/40",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181b20] p-5 shadow-[0_1px_8px_rgba(15,23,42,0.05)] dark:shadow-none">
      {content}
    </div>
  );
}
