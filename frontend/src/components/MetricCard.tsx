interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6 hover:border-[#00E7FF]/30 transition-all">
      <div className="text-[#A5B6C8] mb-2">{title}</div>
      <div className="text-[#E7ECEF] mb-1">{value}</div>
      {subtitle && <div className="text-[#00E7FF]">{subtitle}</div>}
    </div>
  );
}
