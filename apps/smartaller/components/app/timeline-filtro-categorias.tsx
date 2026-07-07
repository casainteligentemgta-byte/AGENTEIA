import Link from "next/link";
import type { CategoriaVehiculoId } from "@/lib/schemas/categoria-vehiculo";
import {
  FILTROS_TIMELINE,
  etiquetaCategoria,
} from "@/lib/vehicles/inferir-categorias-evento";
import { cn } from "@/lib/utils";

type TimelineFiltroCategoriasProps = {
  activo: CategoriaVehiculoId | null;
};

export function TimelineFiltroCategorias({ activo }: TimelineFiltroCategoriasProps) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTROS_TIMELINE.map((filtro) => {
        const href = filtro.id ? `/app/timeline?categoria=${filtro.id}` : "/app/timeline";
        const isActive = activo === filtro.id;

        return (
          <Link
            key={filtro.label}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              isActive
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                : "bg-[#152238]/80 text-zinc-300 ring-1 ring-white/10 hover:bg-[#152238] hover:text-white"
            )}
          >
            {filtro.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TimelineCategoriaChips({ categorias }: { categorias: CategoriaVehiculoId[] }) {
  if (categorias.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {categorias.map((cat) => (
        <span
          key={cat}
          className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-white/10"
        >
          {etiquetaCategoria(cat)}
        </span>
      ))}
    </div>
  );
}
