import { forwardRef, type ComponentType, type ReactNode } from "react";
import type { Icon, IconProps } from "@phosphor-icons/react/dist/lib/types";
import { Drop } from "@phosphor-icons/react/dist/ssr/Drop";
import { BatteryCharging } from "@phosphor-icons/react/dist/ssr/BatteryCharging";
import { Flask } from "@phosphor-icons/react/dist/ssr/Flask";
import { Funnel } from "@phosphor-icons/react/dist/ssr/Funnel";
import { Gauge } from "@phosphor-icons/react/dist/ssr/Gauge";
import { CalendarCheck } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { CarProfile } from "@phosphor-icons/react/dist/ssr/CarProfile";
import { Motorcycle } from "@phosphor-icons/react/dist/ssr/Motorcycle";
import { Bicycle } from "@phosphor-icons/react/dist/ssr/Bicycle";
import { Scooter } from "@phosphor-icons/react/dist/ssr/Scooter";
import { Tractor } from "@phosphor-icons/react/dist/ssr/Tractor";
import { Bulldozer } from "@phosphor-icons/react/dist/ssr/Bulldozer";
import { Bus } from "@phosphor-icons/react/dist/ssr/Bus";
import { Link } from "@phosphor-icons/react/dist/ssr/Link";
import { Engine } from "@phosphor-icons/react/dist/ssr/Engine";
import { GearSix } from "@phosphor-icons/react/dist/ssr/GearSix";
import { Scan } from "@phosphor-icons/react/dist/ssr/Scan";
import { SprayBottle } from "@phosphor-icons/react/dist/ssr/SprayBottle";
import { Wrench } from "@phosphor-icons/react/dist/ssr/Wrench";
import { cn } from "@/lib/utils";

export type CategoriaIcon = ComponentType<IconProps>;

export type CategoriaVisual = {
  Icon: CategoriaIcon;
  colorClasses: string;
};

function withDuotone(PhosphorIcon: Icon): CategoriaIcon {
  const DuotoneIcon = forwardRef<SVGSVGElement, IconProps>(function DuotoneIcon(props, ref) {
    return <PhosphorIcon {...props} ref={ref} weight="duotone" />;
  });
  DuotoneIcon.displayName = PhosphorIcon.displayName ?? "DuotoneIcon";
  return DuotoneIcon;
}

function createCustomDuotoneIcon(
  displayName: string,
  render: () => ReactNode
): CategoriaIcon {
  const CustomIcon = forwardRef<SVGSVGElement, IconProps>(function CustomIcon(
    { className, size = "1em", color = "currentColor", weight: _weight, mirrored: _mirrored, alt, ...rest },
    ref
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden={alt ? undefined : true}
        {...rest}
      >
        {alt ? <title>{alt}</title> : null}
        {render()}
      </svg>
    );
  });
  CustomIcon.displayName = displayName;
  return CustomIcon;
}

const NeumaticosIcon = createCustomDuotoneIcon("NeumaticosIcon", () => (
  <>
    <g opacity=".2" fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="9" />
    </g>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.75" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M12 4.8L12 2.95M15.6 5.76L16.52 4.16M18.24 8.4L19.84 7.47M19.2 12L21.05 12M18.24 15.6L19.84 16.52M15.6 18.24L16.52 19.84M12 19.2L12 21.05M8.4 18.24L7.47 19.84M5.76 15.6L4.16 16.53M4.8 12L2.95 12M5.76 8.4L4.16 7.47M8.4 5.76L7.47 4.16" />
  </>
));

const BalanceoIcon = createCustomDuotoneIcon("BalanceoIcon", () => (
  <>
    <g opacity=".2" fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="7.5" />
    </g>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10V7M12 14v3M10 12H7M14 12h3" />
    <rect x="15.5" y="4.4" width="4.2" height="2.6" rx="1" transform="rotate(45 17.6 5.7)" />
    <rect x="4.3" y="17" width="4.2" height="2.6" rx="1" transform="rotate(45 6.4 18.3)" />
  </>
));

const RotacionIcon = createCustomDuotoneIcon("RotacionIcon", () => (
  <>
    <g opacity=".2" fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="3.4" />
    </g>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
    <circle cx="12" cy="12" r="3.4" />
  </>
));

const AlineacionIcon = createCustomDuotoneIcon("AlineacionIcon", () => (
  <>
    <g opacity=".2" fill="currentColor" stroke="none">
      <rect x="8" y="4" width="8" height="16" rx="3" />
    </g>
    <rect x="8" y="4" width="8" height="16" rx="3" />
    <path d="M10.5 8.5h3M10.5 12h3M10.5 15.5h3" />
    <path d="M3.5 5v14M20.5 5v14" />
  </>
));

const FrenosIcon = createCustomDuotoneIcon("FrenosIcon", () => (
  <>
    <g opacity=".2" fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="9" />
    </g>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="12" cy="6.6" r=".5" />
    <circle cx="12" cy="17.4" r=".5" />
    <circle cx="6.6" cy="12" r=".5" />
    <circle cx="17.4" cy="12" r=".5" />
    <path d="M17.5 4.8a9 9 0 0 1 1.8 1.7" />
  </>
));

export const CATEGORIA_ICONOS = {
  aceite: { Icon: withDuotone(Drop), colorClasses: "bg-amber-100/70 text-amber-600" },
  neumaticos: { Icon: NeumaticosIcon, colorClasses: "bg-slate-100/70 text-slate-600" },
  balanceo: { Icon: BalanceoIcon, colorClasses: "bg-violet-100/70 text-violet-600" },
  rotacion: { Icon: RotacionIcon, colorClasses: "bg-sky-100/70 text-sky-600" },
  alineacion: { Icon: AlineacionIcon, colorClasses: "bg-teal-100/70 text-teal-600" },
  bateria: { Icon: withDuotone(BatteryCharging), colorClasses: "bg-green-100/70 text-green-600" },
  fluidos: { Icon: withDuotone(Flask), colorClasses: "bg-blue-100/70 text-blue-600" },
  frenos: { Icon: FrenosIcon, colorClasses: "bg-red-100/70 text-red-600" },
  filtros: { Icon: withDuotone(Funnel), colorClasses: "bg-orange-100/70 text-orange-600" },
  cadena: { Icon: withDuotone(Link), colorClasses: "bg-stone-100/70 text-stone-600" },
  hidraulico: { Icon: withDuotone(Engine), colorClasses: "bg-cyan-100/70 text-cyan-600" },
  orugas: { Icon: withDuotone(GearSix), colorClasses: "bg-yellow-100/70 text-yellow-700" },
  escaner: { Icon: withDuotone(Scan), colorClasses: "bg-fuchsia-100/70 text-fuchsia-600" },
  limpieza_inyectores: {
    Icon: withDuotone(SprayBottle),
    colorClasses: "bg-lime-100/70 text-lime-700",
  },
  odometro: { Icon: withDuotone(Gauge), colorClasses: "bg-indigo-100/70 text-indigo-600" },
  calendario: { Icon: withDuotone(CalendarCheck), colorClasses: "bg-pink-100/70 text-pink-600" },
  cita: { Icon: withDuotone(CalendarCheck), colorClasses: "bg-pink-100/70 text-pink-600" },
  chat: { Icon: withDuotone(ChatCircleDots), colorClasses: "bg-emerald-100/70 text-emerald-600" },
  auto: { Icon: withDuotone(CarProfile), colorClasses: "bg-blue-100/70 text-blue-600" },
  moto: { Icon: withDuotone(Motorcycle), colorClasses: "bg-violet-100/70 text-violet-600" },
  bicicleta: { Icon: withDuotone(Bicycle), colorClasses: "bg-lime-100/70 text-lime-700" },
  patinete: { Icon: withDuotone(Scooter), colorClasses: "bg-yellow-100/70 text-yellow-700" },
  tractor: { Icon: withDuotone(Tractor), colorClasses: "bg-green-100/70 text-green-700" },
  maquinaria_pesada: { Icon: withDuotone(Bulldozer), colorClasses: "bg-orange-100/70 text-orange-700" },
  jumbo: { Icon: withDuotone(Bus), colorClasses: "bg-indigo-100/70 text-indigo-600" },
  general: { Icon: withDuotone(Wrench), colorClasses: "bg-zinc-100/70 text-zinc-600" },
} satisfies Record<string, CategoriaVisual>;

export type CategoriaIconId = keyof typeof CATEGORIA_ICONOS;

export function getCategoriaVisual(id: string): CategoriaVisual {
  return CATEGORIA_ICONOS[id as CategoriaIconId] ?? CATEGORIA_ICONOS.general;
}

type CategoriaTileProps = {
  id: string;
  className?: string;
  iconClassName?: string;
};

export function CategoriaTile({
  id,
  className,
  iconClassName = "h-7 w-7",
}: CategoriaTileProps) {
  const { Icon, colorClasses } = getCategoriaVisual(id);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        colorClasses,
        className ?? "h-14 w-14"
      )}
    >
      <Icon className={iconClassName} />
    </span>
  );
}
