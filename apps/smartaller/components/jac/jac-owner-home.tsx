import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { JacCarPhoto } from "@/components/jac/jac-car-photo";
import { JacServiceCard } from "@/components/jac/jac-service-card";
import { getBrand } from "@/lib/brand";
import { kilometresUntilNextService } from "@/lib/brand/intervals";
import { JAC_SERVICE_ORDER } from "@/lib/brand/jac-theme";
import type { AlertaRecordatorio } from "@/lib/data/alertas";
import type { RecordatorioUsuario } from "@/lib/data/vehicle-history";
import type { VehiculoUsuario } from "@/lib/vehicles/types";
import type {
  CategoriaSaludResumen,
  VehicleHealthSummary,
} from "@/lib/vehicles/vehicle-health";

type OwnerVehicle = {
  vehiculo: VehiculoUsuario;
  salud: VehicleHealthSummary;
  titulo: string;
  ultimaVisitaKm?: number | null;
};

type JacOwnerHomeProps = {
  nombre: string;
  vehicles: OwnerVehicle[];
  alertas: AlertaRecordatorio[];
  proximaCita?: RecordatorioUsuario | null;
};

function hourInCaracas(date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: "America/Caracas",
  }).format(date);
  return Number.parseInt(hour, 10);
}

function formatHora(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Caracas",
  }).format(new Date(iso));
}

function formatFechaServicio(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Caracas",
  }).format(new Date(iso));
}

function remainingFromObjetivo(objetivo: number, actual: number | null): number {
  if (actual != null && objetivo > actual) return objetivo - actual;
  return objetivo;
}

function formatKm(km: number): string {
  return `${km.toLocaleString("es-VE")} km`;
}

export function JacOwnerHome({
  nombre,
  vehicles,
  alertas,
  proximaCita,
}: JacOwnerHomeProps) {
  const brand = getBrand();
  const copy = brand.copy.owner;
  const principal = vehicles[0] ?? null;
  const modelo = principal?.vehiculo.modelo?.trim() || "JAC";
  const placa = principal?.vehiculo.placa ?? "";
  const color = principal?.vehiculo.color ?? "";
  const inicial = (nombre.trim()[0] ?? "J").toUpperCase();

  const categorias = new Map<string, CategoriaSaludResumen>(
    (principal?.salud.categorias ?? []).map((c) => [c.id, c])
  );
  const estadoNeumaticos = categorias.get("neumaticos")?.estado ?? null;
  const alertaNeumaticos = alertas.find((a) =>
    /caucho|neum|rotac/i.test(
      a.vehiculoLabel.normalize("NFD").replace(/\p{M}/gu, "")
    )
  );
  const mostrarAvisoNeumaticos =
    estadoNeumaticos === "atencion" ||
    estadoNeumaticos === "critico" ||
    Boolean(alertaNeumaticos);

  const kmRotacion = (() => {
    if (alertaNeumaticos?.kilometraje_objetivo != null) {
      return remainingFromObjetivo(
        alertaNeumaticos.kilometraje_objetivo,
        principal?.vehiculo.kilometraje_ultimo ?? null
      );
    }
    if (!principal) return null;
    return kilometresUntilNextService(
      principal.ultimaVisitaKm ?? null,
      principal.vehiculo.kilometraje_ultimo,
      principal.vehiculo.modelo,
      "neumaticos"
    );
  })();

  const avisoNeumaticos = mostrarAvisoNeumaticos
    ? kmRotacion != null && copy.alertNeumaticos
      ? copy.alertNeumaticos(kmRotacion)
      : copy.alertCauchos
    : null;

  const requiereAtencion =
    principal?.salud.peorEstado === "atencion" ||
    principal?.salud.peorEstado === "critico" ||
    (principal?.salud.recordatoriosUrgentes ?? 0) > 0;

  const nextServiceLine = (() => {
    if (!principal) return null;
    const fecha = proximaCita?.fecha_programada
      ? formatFechaServicio(proximaCita.fecha_programada)
      : "";
    let kmLabel = "";
    if (proximaCita?.kilometraje_objetivo != null) {
      kmLabel = formatKm(
        remainingFromObjetivo(
          proximaCita.kilometraje_objetivo,
          principal.vehiculo.kilometraje_ultimo
        )
      );
    } else {
      const remaining = kilometresUntilNextService(
        principal.ultimaVisitaKm ?? null,
        principal.vehiculo.kilometraje_ultimo,
        principal.vehiculo.modelo
      );
      if (remaining != null) kmLabel = formatKm(remaining);
    }
    const line = copy.nextService(kmLabel, fecha);
    return line.trim() ? line : null;
  })();

  const servicioCita = alertaNeumaticos
    ? brand.copy.categories.neumaticos
    : undefined;

  return (
    <div className="relative min-h-dvh bg-[#f3f4f8] pb-28 text-[#1c1c22]">
      <section className="relative h-[230px] overflow-hidden">
        <JacCarPhoto
          modelo={principal?.vehiculo.modelo}
          alt={modelo}
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
        <Image
          src={brand.assets.logoOnDark}
          alt={brand.copy.name}
          width={120}
          height={28}
          className="absolute left-5 top-[max(1rem,env(safe-area-inset-top))] h-7 w-auto"
        />
        <div className="absolute right-5 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-[#1c1c22] shadow-md">
          {inicial}
        </div>
        <div className="absolute inset-x-5 bottom-5 text-white">
          <p className="text-[13px] text-white/80">
            {copy.hello(nombre, hourInCaracas())}
          </p>
          <h1 className="jac-title mt-0.5 text-[26px] leading-tight">
            {copy.statusTitle(modelo, requiereAtencion)}
          </h1>
          <p className="mt-1 text-[13px] text-white/80">
            {[placa, color].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <main className="px-4 pt-5">
        <h2 className="jac-title text-lg text-[#1c1c22]">{copy.servicesTitle}</h2>
        {nextServiceLine ? (
          <p className="mt-1 text-[13px] text-[#5b5b66]">{nextServiceLine}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {JAC_SERVICE_ORDER.map((id) => {
            const cat = categorias.get(id);
            const estado = cat?.estado ?? null;
            const progress =
              estado === "critico" ? 88 : estado === "atencion" ? 62 : estado === "bien" ? 28 : 0;
            return (
              <JacServiceCard
                key={id}
                id={id}
                estado={estado}
                progress={progress}
                alertBar={id === "neumaticos" && estado !== "bien" && estado != null}
                hint={cat?.notas}
              />
            );
          })}
        </div>

        {avisoNeumaticos ? (
          <p className="jac-alert mt-4 px-4 py-3 text-[13px] leading-snug">
            {avisoNeumaticos}
          </p>
        ) : null}

        {proximaCita ? (
          <article className="jac-card mt-4 p-4">
            <p className="text-[13px] font-medium text-[#6a6a74]">{copy.citaTitle}</p>
            <p className="jac-title mt-1 text-lg">
              {copy.citaDetail(formatHora(proximaCita.fecha_programada), servicioCita)}
            </p>
            <Link href="/app/timeline" className="jac-btn mt-4">
              {copy.moveCita}
            </Link>
          </article>
        ) : null}

        {vehicles.length === 0 ? (
          <div className="jac-card mt-6 px-5 py-10 text-center">
            <p className="font-semibold">{copy.emptyVehicles}</p>
            <p className="mt-2 text-sm text-[#5b5b66]">{copy.emptyHint}</p>
            <Link href="/app/vehiculos/nuevo" className="jac-btn mt-5 inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              {copy.addVehicle}
            </Link>
          </div>
        ) : (
          <Link
            href="/app/vehiculos/nuevo"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#1c1c22]"
          >
            <Plus className="h-4 w-4" />
            {copy.addVehicle}
          </Link>
        )}
      </main>
    </div>
  );
}
