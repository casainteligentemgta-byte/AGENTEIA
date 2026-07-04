import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { SmartallerChat } from "@/components/app/chat/smartaller-chat";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getEtiquetaVehiculo } from "@/lib/vehicles/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default async function VehiculoChatPage({ params }: PageProps) {
  const vehiculo = await getUserVehiculoById(params.id);

  if (!vehiculo) notFound();

  const titulo = getEtiquetaVehiculo(vehiculo);

  return (
    <div className="app-bg-light min-h-screen text-zinc-900">
      <AppHeader
        variant="light"
        showBack
        backHref={`/app/vehiculos/${vehiculo.id}`}
        title="Chat Smartaller"
        subtitle={titulo}
      />
      <SmartallerChat
        vehiculoId={vehiculo.id}
        tituloVehiculo={titulo}
        placa={vehiculo.placa}
      />
    </div>
  );
}
