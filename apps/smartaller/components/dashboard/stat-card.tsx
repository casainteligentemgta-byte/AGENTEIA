import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
};

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">{value}</p>
          {trend && <p className="mt-1 text-xs text-zinc-500">{trend}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-blue-400">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
