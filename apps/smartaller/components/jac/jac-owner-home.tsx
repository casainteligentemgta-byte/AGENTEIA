import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { JacCarPhoto } from "@/components/jac/jac-car-photo";
import { JacServiceCard } from "@/components/jac/jac-service-card";
import { getBrand } from "@/lib/brand";
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
};

type JacOwnerHomeProps = {
  nombre: string;
  vehicles: OwnerVehicle[];
  alertas: AlertaRecordatorio[];
  proximaCita?: RecordatorioUsuario | null;
};

function formatHora(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
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
  const alertaCauchos =
    alertas.some((a) => /caucho|neumat/i.test(a.vehiculoLabel)) ||
    categorias.get("neumaticos")?.estado === "atencion" ||
    categorias.get("neumaticos")?.estado === "critico";

  // Sin kilometraje vivo ni intervalos de fábrica: copy de la maqueta.
  const kmHint = "1.200 km";
  const fechaHint = "15 ene 2027";

  return (
    <div className="relative min-h-dvh bg-[#f3f4f8] pb-28 text-[#1c1c22]">
      <section className="relative h-[230px] overflow-hidden">
        <JacCarPhoto
          modelo={principal?.vehiculo.modelo ?? "Tepuy Pro"}
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
          <p className="text-[13px] text-white/80">{copy.hello(nombre)}</p>
          <h1 className="jac-title mt-0.5 text-[26px] leading-tight">
            {copy.statusTitle(modelo)}
          </h1>
          <p className="mt-1 text-[13px] text-white/80">
            {[placa, color].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <main className="px-4 pt-5">
        <h2 className="jac-title text-lg text-[#1c1c22]">{copy.servicesTitle}</h2>
        {principal ? (
          <p className="mt-1 text-[13px] text-[#5b5b66]">
            {copy.nextService(kmHint, fechaHint)}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {JAC_SERVICE_ORDER.map((id) => {
            const cat = categorias.get(id);
            const estado = cat?.estado ?? (id === "alineacion" ? "atencion" : "bien");
            const progress =
              estado === "critico" ? 88 : estado === "atencion" ? 62 : 28;
            return (
              <JacServiceCard
                key={id}
                id={id}
                estado={estado}
                progress={progress}
                alertBar={id === "neumaticos" && estado !== "bien"}
                hint={cat?.notas}
              />
            );
          })}
        </div>

        {alertaCauchos || (principal && principal.salud.recordatoriosUrgentes > 0) ? (
          <p className="jac-alert mt-4 px-4 py-3 text-[13px] leading-snug">
            {copy.alertCauchos}
          </p>
        ) : null}

        {proximaCita ? (
          <article className="jac-card mt-4 p-4">
            <p className="text-[13px] font-medium text-[#6a6a74]">{copy.citaTitle}</p>
            <p className="jac-title mt-1 text-lg">
              {copy.citaDetail(
                formatHora(proximaCita.fecha_programada),
                brand.copy.categories.neumaticos.toLowerCase()
              )}
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
