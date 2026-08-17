import Image from "next/image";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  COMPONENT_TYPE_LABELS,
  type BikeComponent,
  type Shop,
} from "@/lib/smartbike/types";
import { wearPercent } from "@/lib/smartbike/component-wear";
import { cn } from "@/lib/utils";

type AlertaSustitucionProps = {
  shop: Shop;
  component: BikeComponent;
  bookingHref?: string;
  className?: string;
};

export function AlertaSustitucion({
  shop,
  component,
  bookingHref = "#",
  className,
}: AlertaSustitucionProps) {
  const pct = wearPercent(component.km_accumulated, component.km_limit);
  const isCritical = component.status === "red";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        isCritical
          ? "border-red-200 bg-gradient-to-br from-red-50 to-white"
          : "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        {shop.logo_url ? (
          <Image
            src={shop.logo_url}
            alt={shop.name}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ring-white"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            {shop.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                "h-4 w-4 shrink-0",
                isCritical ? "text-red-600" : "text-amber-600"
              )}
            />
            <p className="text-sm font-bold text-zinc-900">{shop.name} te informa</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            Tu componente{" "}
            <strong>{COMPONENT_TYPE_LABELS[component.component_type]}</strong> (
            {component.brand_model}) ha alcanzado el{" "}
            <strong>{pct}%</strong> de uso recomendado.
          </p>
          <Link
            href={bookingHref}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            Agendar cita aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
