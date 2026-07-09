import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrdenRecepcionCreateForm } from "@/components/dashboard/orden-recepcion-create-form";
import { getVehiculoDetalle } from "@/lib/data/vehiculos";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import type { TipoVehiculo } from "@/lib/vehicles/types";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
  searchParams: { nuevo?: string };
};

export default async function InspeccionVehiculoPage({ params, searchParams }: Props) {
  const vehiculo = await getVehiculoDetalle(params.id);
  if (!vehiculo) notFound();

  const config = getConfigTipoVehiculo((vehiculo.tipo_vehiculo ?? "auto") as TipoVehiculo);
  const odometroInicial =
    config.unidadOdometro === "horas"
      ? vehiculo.horas_motor_ultimo
      : vehiculo.kilometraje_ultimo;
  const odometroLabel =
    config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje";

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
        </p>
      </div>

      <OrdenRecepcionCreateForm
        vehiculoId={vehiculo.id}
        placa={vehiculo.placa}
        odometroInicial={odometroInicial}
        odometroLabel={odometroLabel}
        recienRegistrado={searchParams.nuevo === "1"}
      />
    </div>
  );
}
