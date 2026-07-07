import Image from "next/image";
import {
  COMPONENT_TYPE_LABELS,
  BIKE_STATUS_LABELS,
  type BikeComponent,
  type BikeWithComponents,
} from "@/lib/bicicopilot/types";
import {
  STATUS_STYLES,
  wearPercent,
} from "@/lib/bicicopilot/component-wear";
import { cn } from "@/lib/utils";
import { Bike, Hash, Shield } from "lucide-react";

type CarnetDigitalProps = {
  bike: BikeWithComponents;
};

function ComponentRow({ component }: { component: BikeComponent }) {
  const pct = wearPercent(component.km_accumulated, component.km_limit);
  const style = STATUS_STYLES[component.status];

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {COMPONENT_TYPE_LABELS[component.component_type]}
          </p>
          <p className="text-xs text-zinc-500">{component.brand_model}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            style.badge
          )}
        >
          {style.label}
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
          <span>
            {component.km_accumulated.toLocaleString("es-CO", { maximumFractionDigits: 0 })} km
          </span>
          <span>{pct}% · límite {component.km_limit.toLocaleString("es-CO")} km</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
          <div
            className={cn("h-full rounded-full transition-all", style.bar)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function CarnetDigital({ bike }: CarnetDigitalProps) {
  const statusLabel = BIKE_STATUS_LABELS[bike.status];

  return (
    <article className="app-card-white overflow-hidden">
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-brand-100">
              Carnet digital BiciCopilot
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {bike.brand} {bike.model}
            </h1>
            {bike.color && (
              <p className="mt-1 text-sm text-brand-100 capitalize">{bike.color}</p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Bike className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-zinc-100 p-4 sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3">
          <Hash className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div>
            <p className="text-[11px] font-medium uppercase text-zinc-500">Nº serie cuadro</p>
            <p className="font-mono text-sm font-semibold text-zinc-900">{bike.frame_serial}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div>
            <p className="text-[11px] font-medium uppercase text-zinc-500">Estado legal</p>
            <p className="text-sm font-semibold text-zinc-900">{statusLabel}</p>
          </div>
        </div>
        {bike.size && (
          <p className="text-xs text-zinc-500 sm:col-span-2">
            Talla {bike.size}
            {bike.material ? ` · ${bike.material}` : ""}
          </p>
        )}
      </div>

      {bike.shop && (
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
          {bike.shop.logo_url ? (
            <Image
              src={bike.shop.logo_url}
              alt={bike.shop.name}
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
              {bike.shop.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500">Taller de confianza</p>
            <p className="text-sm font-semibold text-zinc-900">{bike.shop.name}</p>
          </div>
        </div>
      )}

      <div className="p-4">
        <h2 className="mb-3 text-sm font-bold text-zinc-900">Componentes y desgaste</h2>
        <div className="space-y-3">
          {bike.components.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin componentes registrados.</p>
          ) : (
            bike.components.map((c) => <ComponentRow key={c.id} component={c} />)
          )}
        </div>
      </div>
    </article>
  );
}
