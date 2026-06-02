import { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
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
  trend,
  subtitle,
  active = false,
  onClick,
}: KPICardProps) {
  const content = (
    <>
      <div className={`p-2.5 rounded-lg bg-[#1A1A1A] ${iconColor}`}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-gray-400 text-sm mb-0.5 truncate">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {subtitle && (
          <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>
        )}
        {trend && (
          <div
            className={`flex items-center gap-1 mt-1 text-xs font-medium ${
              trend.positive ? "text-green-400" : "text-red-400"
            }`}
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
        className={`bg-[#242424] border rounded-xl p-5 flex items-start gap-4 transition-colors hover:border-[#CC2229] ${
          active ? "border-[#CC2229]" : "border-[#3A3A3A]"
        }`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5 flex items-start gap-4">
      {content}
    </div>
  );
}
