import { getServicioConfig } from "@/lib/service-centers/constants";
import type { ServicioCentroId } from "@/lib/service-centers/types";

type ServiceTagsProps = {
  servicios: ServicioCentroId[];
  compact?: boolean;
};

export function ServiceTags({ servicios, compact = false }: ServiceTagsProps) {
  return (
    <div
      className={
        compact
          ? "flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          : "flex flex-wrap gap-2"
      }
    >
      {servicios.map((id) => {
        const config = getServicioConfig(id);
        if (!config) return null;
        const Icon = config.icon;
        return (
          <span
            key={id}
            title={config.label}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="max-w-[7rem] truncate">{config.label}</span>
          </span>
        );
      })}
    </div>
  );
}
