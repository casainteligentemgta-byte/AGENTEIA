import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getBikeWithComponents } from "@/lib/data/smartbike";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default async function BicicletaDetallePage({ params }: PageProps) {
  const { id } = params;

  const vehiculo = await getUserVehiculoById(id);
  if (vehiculo?.tipo_vehiculo === "bicicleta") {
    redirect(`/app/vehiculos/${id}`);
  }

  const bike = await getBikeWithComponents(id);
  if (bike?.vehiculo_id) {
    redirect(`/app/vehiculos/${bike.vehiculo_id}`);
  }

  const supabase = createClient();
  const { data: bikeByVehiculo } = await supabase
    .from("bikes")
    .select("vehiculo_id")
    .eq("vehiculo_id", id)
    .maybeSingle();

  if (bikeByVehiculo?.vehiculo_id) {
    redirect(`/app/vehiculos/${bikeByVehiculo.vehiculo_id}`);
  }

  notFound();
}
