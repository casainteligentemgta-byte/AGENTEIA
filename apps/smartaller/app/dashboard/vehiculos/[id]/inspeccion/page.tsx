import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrdenRecepcionCreateForm } from "@/components/dashboard/orden-recepcion-create-form";
import { getVehiculoDetalle } from "@/lib/data/vehiculos";
import { getConfigTipoVehiculo, normalizeTipoVehiculo } from "@/lib/vehicles/templates";
import { buildFichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";
import { obtenerTelegramRecepcionSesion } from "@/lib/telegram-recepcion-sesion";
import { estadoVisualConFrontalPrefill } from "@/lib/schemas/estado-visual-recepcion";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
  searchParams: { telegram?: string; sesion?: string };
};

export default async function InspeccionVehiculoPage({ params, searchParams }: Props) {
  const vehiculo = await getVehiculoDetalle(params.id);
  if (!vehiculo) notFound();

  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  const odometroInicial =
    config.unidadOdometro === "horas"
      ? vehiculo.horas_motor_ultimo
      : vehiculo.kilometraje_ultimo;
  const odometroLabel =
    config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje";
  const fichaVehiculo = buildFichaVehiculoInspeccion(vehiculo);

  const sesion =
    searchParams.sesion && searchParams.telegram === "1"
      ? await obtenerTelegramRecepcionSesion(searchParams.sesion, vehiculo.id)
      : null;

  const frontalDesdeTelegram = Boolean(sesion);
  const estadoVisualInicial = sesion
    ? estadoVisualConFrontalPrefill({
        url: sesion.frontalUrl,
        path: sesion.frontalPath,
      })
    : undefined;
  const pasoInicial = 0;

  return (
    <div className="p-4 sm:p-8">
      <Link
        href={`/dashboard/vehiculos/${vehiculo.id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al vehículo
      </Link>

      <div className="mb-8">
        <p className="font-mono text-sm text-blue-400">{vehiculo.placa}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Inspección de ingreso
        </h1>
        <p className="mt-1 text-zinc-500">
          {vehiculo.nombre_cliente ?? "Sin propietario"}
          {vehiculo.marca && vehiculo.modelo ? ` · ${vehiculo.marca} ${vehiculo.modelo}` : ""}
          {frontalDesdeTelegram
            ? " · Foto frontal desde Telegram; márcala con el lápiz y continúa con el resto."
            : " · La cámara guía paso a paso hasta el protocolo de inspección."}
        </p>
      </div>

      <OrdenRecepcionCreateForm
        vehiculoId={vehiculo.id}
        placa={vehiculo.placa}
        odometroInicial={odometroInicial}
        odometroLabel={odometroLabel}
        fichaVehiculo={fichaVehiculo}
        recienRegistrado={false}
        desdeTelegram={searchParams.telegram === "1"}
        frontalDesdeTelegram={frontalDesdeTelegram}
        estadoVisualInicial={estadoVisualInicial}
        pasoInicial={pasoInicial}
      />
    </div>
  );
}
