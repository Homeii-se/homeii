"use client";

interface ConsumptionCardProps {
  label: string;
  value: string;
  unit: string;
  subtitle?: string;
  color?: string;
}

export default function ConsumptionCard({
  label,
  value,
  unit,
  subtitle,
  color = "text-brand-300",
}: ConsumptionCardProps) {
  return (
    <div className="glass-card flex flex-col gap-1 rounded-2xl p-4">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        <span className="text-sm text-text-muted">{unit}</span>
      </div>
      {subtitle && (
        <span className="text-xs text-text-muted">{subtitle}</span>
      )}
    </div>
  );
}
